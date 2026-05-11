UPDATE comments_index AS c
SET line_number = p.line_number,
    line_range_start = p.line_range_start,
    line_range_end = p.line_range_end
FROM comments_index AS p
WHERE c.author_type = 'nostr'
  AND c.parent_uri IS NOT NULL
  AND c.line_number IS NULL
  AND c.line_range_start IS NULL
  AND (p.uri = c.parent_uri OR p.cid = c.parent_uri)
  AND (p.line_number IS NOT NULL OR p.line_range_start IS NOT NULL);