-- Create database schema for file search system
-- This would be used with a proper database like PostgreSQL or SQLite

CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS file_content (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    content_text TEXT NOT NULL,
    page_number INTEGER,
    line_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);
CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type);
CREATE INDEX IF NOT EXISTS idx_content_search ON file_content USING gin(to_tsvector('english', content_text));
CREATE INDEX IF NOT EXISTS idx_content_file_id ON file_content(file_id);
CREATE INDEX IF NOT EXISTS idx_content_page ON file_content(page_number);
CREATE INDEX IF NOT EXISTS idx_content_line ON file_content(line_number);

-- Insert sample data for testing
INSERT INTO files (filename, file_type, file_url, file_size) VALUES
('project-report.pdf', 'application/pdf', '/files/project-report.pdf', 2048576),
('meeting-notes.docx', 'application/msword', '/files/meeting-notes.docx', 524288),
('readme.txt', 'text/plain', '/files/readme.txt', 4096);

INSERT INTO file_content (file_id, content_text, page_number, line_number) VALUES
(1, 'This quarterly report demonstrates significant growth in our key performance indicators.', 1, NULL),
(1, 'Revenue increased by 25% compared to the previous quarter, exceeding our projections.', 2, NULL),
(2, 'Meeting agenda: Discuss project timeline and resource allocation for Q4.', NULL, 1),
(2, 'Action items: Review budget proposals and finalize team assignments.', NULL, 5),
(3, 'Welcome to the project documentation. This file contains setup instructions.', NULL, 1),
(3, 'Please follow the installation guide carefully to avoid configuration issues.', NULL, 3);
