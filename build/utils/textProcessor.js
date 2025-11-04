"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextProcessor = void 0;
class TextProcessor {
    /**
     * Clean and structure raw extracted text from PDF/Word documents
     */
    static processRawText(rawText, fileName) {
        if (rawText.length > 1000000) { // 1MB threshold
            return this.processLargeText(rawText, fileName);
        }
        // Step 1: Clean the text
        let cleanedText = this.cleanText(rawText);
        // Step 2: Structure into sections
        const structuredContent = this.structureContent(cleanedText);
        // Step 3: Generate metadata
        const metadata = this.generateMetadata(cleanedText, structuredContent, fileName);
        // Step 4: Generate summary
        const summary = this.generateSummary(structuredContent);
        return {
            rawText: cleanedText,
            structuredContent,
            summary,
            metadata
        };
    }
    static processLargeText(rawText, fileName) {
        console.log('Processing large document in chunks...');
        // Process in 500KB chunks
        const chunkSize = 500000;
        const chunks = [];
        for (let i = 0; i < rawText.length; i += chunkSize) {
            chunks.push(rawText.substring(i, i + chunkSize));
        }
        let fullCleanedText = '';
        const allSections = [];
        let currentPage = 1;
        for (const chunk of chunks) {
            const cleanedChunk = this.cleanText(chunk);
            fullCleanedText += cleanedChunk;
            const chunkSections = this.structureContent(cleanedChunk);
            // Update page numbers for continuity
            const updatedSections = chunkSections.map(section => ({
                ...section,
                pageNumber: section.pageNumber + currentPage - 1
            }));
            allSections.push(...updatedSections);
            // Estimate page increment (rough calculation)
            const estimatedPages = Math.ceil(cleanedChunk.length / 3000); // ~3000 chars per page
            currentPage += estimatedPages;
        }
        const metadata = this.generateMetadata(fullCleanedText, allSections, fileName);
        const summary = this.generateSummary(allSections);
        return {
            rawText: fullCleanedText,
            structuredContent: allSections,
            summary,
            metadata
        };
    }
    static cleanText(text) {
        return text
            // Normalize line breaks and whitespace
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with 2
            .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
            .replace(/\n /g, '\n') // Remove spaces at beginning of lines
            .replace(/ \n/g, '\n') // Remove spaces at end of lines
            // Fix common PDF extraction artifacts
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase words
            .replace(/([.!?])([A-Z])/g, '$1 $2') // Ensure space after punctuation
            .replace(/(\d)([A-Z])/g, '$1 $2') // Separate numbers from letters
            .replace(/([A-Z])(\d)/g, '$1 $2') // Separate letters from numbers
            // Trim and clean up
            .trim();
    }
    static structureContent(text) {
        const lines = text.split('\n');
        const sections = [];
        let currentPage = 1;
        let currentSectionId = 'intro';
        let headingStack = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line)
                continue;
            // Detect page numbers
            const pageMatch = line.match(/^(\d+)$/);
            if (pageMatch && i > 0 && i < lines.length - 1) {
                currentPage = parseInt(pageMatch[1]);
                continue;
            }
            // Detect headings
            const headingLevel = this.detectHeadingLevel(line);
            if (headingLevel > 0) {
                const sectionId = this.generateSectionId(line);
                // Update heading stack
                while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= headingLevel) {
                    headingStack.pop();
                }
                headingStack.push({ id: sectionId, level: headingLevel });
                currentSectionId = sectionId;
                sections.push({
                    type: 'heading',
                    content: line,
                    level: headingLevel,
                    pageNumber: currentPage,
                    sectionId,
                    parentSectionId: headingStack.length > 1 ? headingStack[headingStack.length - 2].id : undefined
                });
                continue;
            }
            // Detect lists
            if (this.isListItem(line)) {
                sections.push({
                    type: 'list',
                    content: line,
                    pageNumber: currentPage,
                    sectionId: currentSectionId
                });
                continue;
            }
            // Regular paragraph
            sections.push({
                type: 'paragraph',
                content: line,
                pageNumber: currentPage,
                sectionId: currentSectionId
            });
        }
        return sections;
    }
    static detectHeadingLevel(line) {
        // Check for numbered headings (1., 1.1, 1.1.1, etc.)
        const numberedMatch = line.match(/^(\d+(?:\.\d+)*)\.?\s+/);
        if (numberedMatch) {
            const depth = numberedMatch[1].split('.').length;
            return Math.min(depth, 6); // Max h6
        }
        // Check for chapter/section headings
        const chapterMatch = line.match(/^(chapter|section|part|unit|appendix)\s+/i);
        if (chapterMatch)
            return 1;
        // Check for ALL CAPS headings (likely h1 or h2)
        if (line === line.toUpperCase() && line.length < 100) {
            return line.length < 50 ? 1 : 2;
        }
        // Check for bold patterns (common in PDF extraction)
        if (line.length < 200 && !line.match(/[.!?]$/) && line.split(' ').length < 15) {
            return 2;
        }
        return 0; // Not a heading
    }
    static isListItem(line) {
        return /^[\s]*[•\-*\d+\.]\s+/.test(line) ||
            /^[\s]*\(?[a-zA-Z0-9]\)\s+/.test(line);
    }
    static generateSectionId(content) {
        return content
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
    }
    static generateMetadata(text, sections, fileName) {
        const wordCount = text.split(/\s+/).length;
        const sectionCount = sections.filter(s => s.type === 'heading').length;
        const totalPages = Math.max(...sections.map(s => s.pageNumber), 1);
        const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute
        return {
            totalPages,
            wordCount,
            sectionCount,
            estimatedReadingTime
        };
    }
    static generateSummary(sections) {
        // const headings = sections.filter(s => s.type === 'heading' && s.level <= 2);
        const headings = sections.filter(s => s.type === 'heading' && s.level !== undefined && s.level <= 2);
        const mainHeadings = headings.map(h => h.content).slice(0, 5);
        return `This document contains ${headings.length} sections including: ${mainHeadings.join(', ')}`;
    }
    /**
     * Convert structured content to formatted text for display
     */
    static formatForDisplay(structuredContent) {
        return structuredContent.map(section => {
            switch (section.type) {
                case 'heading':
                    const prefix = '#'.repeat(section.level || 1);
                    return `${prefix} ${section.content}\n\n`;
                case 'list':
                    return `• ${section.content}\n`;
                case 'paragraph':
                    return `${section.content}\n\n`;
                default:
                    return `${section.content}\n\n`;
            }
        }).join('');
    }
    /**
     * Get table of contents from structured content
     */
    static generateTableOfContents(structuredContent) {
        return structuredContent
            .filter(section => section.type === 'heading')
            .map(section => ({
            title: section.content,
            level: section.level || 1,
            sectionId: section.sectionId,
            pageNumber: section.pageNumber
        }));
    }
}
exports.TextProcessor = TextProcessor;
