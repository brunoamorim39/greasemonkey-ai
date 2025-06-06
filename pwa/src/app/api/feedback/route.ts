import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAuth } from '@/lib/auth'

interface FeedbackData {
  type: 'bug' | 'feature' | 'general'
  subject: string
  description: string
  email?: string
  rating?: number
  reproduction_steps?: string
  expected_behavior?: string
  actual_behavior?: string
  urgency?: 'low' | 'medium' | 'high'
  system_info: {
    userAgent: string
    url: string
    timestamp: string
    viewport: string
    platform: string
  }
}

async function submitFeedbackHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId
    const body = await request.json() as FeedbackData

    // Validate required fields
    if (!body.subject || !body.description || !body.type) {
      return NextResponse.json(
        { error: 'Subject, description, and type are required' },
        { status: 400 }
      )
    }

    // Store feedback in database
    const { data, error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId,
        type: body.type,
        subject: body.subject,
        description: body.description,
        email: body.email || null,
        rating: body.rating || null,
        reproduction_steps: body.reproduction_steps || null,
        expected_behavior: body.expected_behavior || null,
        actual_behavior: body.actual_behavior || null,
        urgency: body.urgency || 'medium',
        system_info: body.system_info,
        status: 'open',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing feedback:', error)

      // If database storage fails, try to send email directly
      try {
        await sendFeedbackEmail(body, userId)
        return NextResponse.json({
          message: 'Feedback submitted via email backup',
          warning: 'Database storage failed but email was sent'
        })
      } catch (emailError) {
        console.error('Email fallback also failed:', emailError)
        return NextResponse.json(
          { error: 'Failed to submit feedback. Please contact support directly.' },
          { status: 500 }
        )
      }
    }

    // Try to send email notification (non-blocking)
    try {
      await sendFeedbackEmail(body, userId)
    } catch (emailError) {
      console.error('Email notification failed (but feedback was saved):', emailError)
      // Don't fail the request if email fails - feedback is saved
    }

    return NextResponse.json({
      message: 'Feedback submitted successfully',
      feedback_id: data.id
    })
  } catch (error) {
    console.error('Error submitting feedback:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}

async function sendFeedbackEmail(feedback: FeedbackData, userId: string) {
  const emailContent = `
New ${feedback.type} feedback from user ${userId}

Subject: ${feedback.subject}
Type: ${feedback.type.toUpperCase()}
${feedback.urgency ? `Urgency: ${feedback.urgency}` : ''}
${feedback.rating ? `Rating: ${feedback.rating}/5` : ''}
${feedback.email ? `User Email: ${feedback.email}` : ''}

Description:
${feedback.description}

${feedback.reproduction_steps ? `
Reproduction Steps:
${feedback.reproduction_steps}
` : ''}

${feedback.expected_behavior ? `
Expected Behavior:
${feedback.expected_behavior}
` : ''}

${feedback.actual_behavior ? `
Actual Behavior:
${feedback.actual_behavior}
` : ''}

System Information:
- User Agent: ${feedback.system_info.userAgent}
- URL: ${feedback.system_info.url}
- Viewport: ${feedback.system_info.viewport}
- Platform: ${feedback.system_info.platform}
- Timestamp: ${feedback.system_info.timestamp}
  `

  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, logging email content:', emailContent)
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'feedback@gupler.io',
      to: 'support@gupler.io',
      subject: `[GreaseMonkey AI- ${feedback.type.toUpperCase()}] ${feedback.subject}`,
      text: emailContent
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${response.status} ${error}`)
  }

  const result = await response.json()
  console.log('Feedback email sent:', result.id)
}

export const POST = withAuth(submitFeedbackHandler)
