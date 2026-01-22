-- Add emoji column to likes_index for reaction system
ALTER TABLE likes_index ADD COLUMN emoji TEXT NOT NULL DEFAULT '👍';

-- Add index for efficient emoji aggregation
CREATE INDEX idx_likes_emoji ON likes_index(subject_uri, emoji);