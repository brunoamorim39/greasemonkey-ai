import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAuth } from '@/lib/auth'

type Priority = 'low' | 'normal' | 'high' | 'urgent'
type Category = 'technical' | 'billing' | 'account' | 'feature' | 'other'

interface SupportTicket {
  category: Category
  priority: Priority
  subject: string
  description: string
  email: string
  phone?: string
  preferred_contact: 'email' | 'phone'
  system_info: {
    userAgent: string
    url: string
    timestamp: string
    viewport: string
    platform: string
  }
}

async function submitSupportTicketHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId
    const body = await request.json() as SupportTicket

    // Validate required fields
    if (!body.subject || !body.description || !body.email || !body.category || !body.priority) {
      return NextResponse.json(
        { error: 'Subject, description, email, category, and priority are required' },
        { status: 400 }
      )
    }

    // Generate ticket ID
    const ticketId = `SUPPORT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Store support ticket in database
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        id: ticketId,
        user_id: userId,
        category: body.category,
        priority: body.priority,
        subject: body.subject,
        description: body.description,
        email: body.email,
        phone: body.phone || null,
        preferred_contact: body.preferred_contact,
        system_info: body.system_info,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing support ticket:', error)

      // If database storage fails, try to send email directly
      try {
        await sendSupportEmail(body, userId, ticketId)
        return NextResponse.json({
          message: 'Support ticket submitted via email backup',
          ticket_id: ticketId,
          warning: 'Database storage failed but email was sent'
        })
      } catch (emailError) {
        console.error('Email fallback also failed:', emailError)
        return NextResponse.json(
          { error: 'Failed to submit support ticket. Please contact support directly.' },
          { status: 500 }
        )
      }
    }

    // Try to send email notification (non-blocking)
    try {
      await sendSupportEmail(body, userId, ticketId)
    } catch (emailError) {
      console.error('Email notification failed (but ticket was saved):', emailError)
      // Don't fail the request if email fails - ticket is saved
    }

    return NextResponse.json({
      message: 'Support ticket submitted successfully',
      ticket_id: ticketId,
      priority: body.priority,
      estimated_response_time: getResponseTime(body.priority)
    })
  } catch (error) {
    console.error('Error submitting support ticket:', error)
    return NextResponse.json(
      { error: 'Failed to submit support ticket' },
      { status: 500 }
    )
  }
}

function getResponseTime(priority: Priority): string {
  switch (priority) {
    case 'urgent': return '1-2 hours'
    case 'high': return '4-8 hours'
    case 'normal': return '1-2 business days'
    case 'low': return '3-5 business days'
  }
}

async function sendSupportEmail(ticket: SupportTicket, userId: string, ticketId: string) {
  const emailContent = `
New Support Ticket: ${ticketId}

User ID: ${userId}
Priority: ${ticket.priority.toUpperCase()}
Category: ${ticket.category}
Subject: ${ticket.subject}

Contact Information:
- Email: ${ticket.email}
${ticket.phone ? `- Phone: ${ticket.phone}` : ''}
- Preferred Contact: ${ticket.preferred_contact}

Issue Description:
${ticket.description}

System Information:
- User Agent: ${ticket.system_info.userAgent}
- URL: ${ticket.system_info.url}
- Viewport: ${ticket.system_info.viewport}
- Platform: ${ticket.system_info.platform}
- Timestamp: ${ticket.system_info.timestamp}

---
Expected Response Time: ${getResponseTime(ticket.priority)}
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
      from: 'support@gupler.io',
      to: 'support@gupler.io',
      subject: `[GreaseMonkey AI Support - ${ticket.priority.toUpperCase()}] ${ticket.subject}`,
      text: emailContent
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${response.status} ${error}`)
  }

  const result = await response.json()
  console.log('Support ticket email sent:', result.id)
}

export const POST = withAuth(submitSupportTicketHandler)
