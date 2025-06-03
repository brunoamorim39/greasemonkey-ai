import 'package:flutter/material.dart';
import '../../models/document.dart';

class DocumentSourcesWidget extends StatelessWidget {
  final List<DocumentSource> sources;
  final bool isExpanded;
  final VoidCallback? onToggle;

  const DocumentSourcesWidget({
    super.key,
    required this.sources,
    this.isExpanded = false,
    this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    if (sources.isEmpty) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.only(top: 8),
      color: Colors.grey[800]?.withOpacity(0.8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          InkWell(
            onTap: onToggle,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(
                    Icons.library_books,
                    size: 16,
                    color: Colors.blue[400],
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Sources (${sources.length})',
                    style: TextStyle(
                      color: Colors.grey[300],
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  if (onToggle != null)
                    Icon(
                      isExpanded ? Icons.expand_less : Icons.expand_more,
                      size: 16,
                      color: Colors.grey[400],
                    ),
                ],
              ),
            ),
          ),

          // Collapsed preview
          if (!isExpanded) ...[
            Padding(
              padding: const EdgeInsets.only(left: 12, right: 12, bottom: 12),
              child: Wrap(
                spacing: 6,
                children: sources
                    .take(3)
                    .map((source) => Chip(
                          label: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                source.type.icon,
                                size: 10,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                source.title.length > 20
                                    ? '${source.title.substring(0, 20)}...'
                                    : source.title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                ),
                              ),
                            ],
                          ),
                          backgroundColor: source.type.color.withOpacity(0.7),
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                          visualDensity: VisualDensity.compact,
                        ))
                    .toList(),
              ),
            ),
          ],

          // Expanded view
          if (isExpanded) ...[
            const Divider(height: 1, color: Colors.grey),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: sources.length,
              separatorBuilder: (context, index) => Divider(
                height: 1,
                color: Colors.grey[700],
                indent: 12,
                endIndent: 12,
              ),
              itemBuilder: (context, index) {
                final source = sources[index];
                return _buildSourceItem(source);
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSourceItem(DocumentSource source) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Source header
          Row(
            children: [
              Icon(
                source.type.icon,
                size: 16,
                color: source.type.color,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  source.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.grey[700],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${(source.relevanceScore * 100).toInt()}%',
                  style: TextStyle(
                    color: Colors.grey[300],
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),

          // Document type badge
          const SizedBox(height: 6),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: source.type.color.withOpacity(0.2),
                  border: Border.all(color: source.type.color, width: 1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  source.type.displayName,
                  style: TextStyle(
                    color: source.type.color,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),

          // Snippet
          if (source.snippet.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.grey[900]?.withOpacity(0.5),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: Colors.grey[700]!, width: 1),
              ),
              child: Text(
                source.snippet,
                style: TextStyle(
                  color: Colors.grey[300],
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A simplified version for showing sources inline in chat bubbles
class InlineSourcesWidget extends StatelessWidget {
  final List<DocumentSource> sources;

  const InlineSourcesWidget({
    super.key,
    required this.sources,
  });

  @override
  Widget build(BuildContext context) {
    if (sources.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        children: sources
            .take(2)
            .map((source) => Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: source.type.color.withOpacity(0.2),
                    border: Border.all(color: source.type.color, width: 1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        source.type.icon,
                        size: 8,
                        color: source.type.color,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        source.title.length > 15
                            ? '${source.title.substring(0, 15)}...'
                            : source.title,
                        style: TextStyle(
                          color: source.type.color,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }
}

/// Widget to encourage document uploads when no sources are found
class NoSourcesPromptWidget extends StatelessWidget {
  final VoidCallback? onUploadPressed;

  const NoSourcesPromptWidget({
    super.key,
    this.onUploadPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(top: 8),
      color: Colors.blue[900]?.withOpacity(0.3),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(
              Icons.lightbulb_outline,
              size: 16,
              color: Colors.blue[400],
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Upload your service manuals for more specific answers',
                style: TextStyle(
                  color: Colors.blue[300],
                  fontSize: 11,
                ),
              ),
            ),
            if (onUploadPressed != null) ...[
              const SizedBox(width: 8),
              TextButton(
                onPressed: onUploadPressed,
                style: TextButton.styleFrom(
                  foregroundColor: Colors.blue[400],
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  'Upload',
                  style: TextStyle(fontSize: 10),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
