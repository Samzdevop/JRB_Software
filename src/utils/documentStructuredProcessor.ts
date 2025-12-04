export interface ProcessedContent {
  rawText: string;
  [key: string]: any;
}

export interface DocumentMetadata {
  source: string;
  publisher: string;
  pageRange: string;
  format: string;
  encoding: string;
}

export interface Schedule {
  id: string;
  schedule: string;
  scheduleNumber: number;
  scheduleTitle: string;
  markdownContent: string[];
}

export type ContentItem = string | ListItem | NumberedListItem;

export interface ListItem {
  letter: string;
  content: ContentItem[];
}

export interface NumberedListItem {
  number: string;
  content: ContentItem[];
}

export interface Section {
  id: string;
  section: string;
  sectionNumber: number;
  sectionTitle: string;
  markdownContent: ContentItem[];
}

export interface Part {
  id: string;
  part: string;
  partNumber: number;
  partTitle: string;
  sections: Section[];
}

export interface Chapter {
  id: string;
  chapter: string;
  chapterNumber: number;
  chapterTitle: string;
  parts: Part[];
}

export interface StructuredDocument {
  id: string;
  title: string;
  actNumber: string;
  year: number;
  commencementDate: string;
  description: string;
  chapters: Chapter[];
  schedules: Schedule[];
  metadata: DocumentMetadata;
}

export class DocumentStructuredProcessor {
  /**
   * Convert processed content to structured API response format
   */
  static processToStructuredFormat(
    processedContent: ProcessedContent, 
    documentId: string, 
    originalFileName: string
  ): StructuredDocument {
    
    const { rawText } = processedContent;
    
    console.log('=== PROCESSING DOCUMENT ===');
    console.log('Text length:', rawText.length);
    
    // Find where the actual content starts (after table of contents)
    const contentStartIndex = this.findContentStartIndex(rawText);
    
    if (contentStartIndex === -1) {
      console.log('Could not find content start, using full text');
      return this.processFullDocument(rawText, documentId, originalFileName);
    }
    
    // Extract only the content part (from CHAPTER 1 onwards)
    const contentText = rawText.substring(contentStartIndex);
    console.log('Content text starts at index:', contentStartIndex);
    console.log('Content text length:', contentText.length);
    
    return this.processFullDocument(contentText, documentId, originalFileName);
  }

  /**
   * Find where the actual document content starts (after table of contents)
   */
  private static findContentStartIndex(text: string): number {
    // Look for patterns that indicate the start of actual content
    const patterns = [
      /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS\s+PART\s+I[—\-]\s*OBJECTIVES\s+AND\s+APPLICATION\s*\n\s*\d+\.\s+/i,
      /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS[^\n]*\n\s*\d+\.\s+The\s+property\s+and\s+ownership/i,
      /CHAPTER\s+1[—\-][\s\S]*?1\.\s+The\s+property\s+and\s+ownership/i,
      /PETROLEUM\s+INDUSTRY\s+ACT,\s*2021[\s\S]*?CHAPTER\s+1[—\-]/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match.index!;
      }
    }
    
    const section1Index = text.search(/\n\s*1\.\s+The\s+property\s+and\s+ownership/i);
    if (section1Index !== -1) {
      const chapterStart = text.lastIndexOf('CHAPTER', section1Index);
      if (chapterStart !== -1) {
        return chapterStart;
      }
      return section1Index;
    }
    
    return -1;
  }

  /**
   * Process the full document (once content is extracted)
   */
  private static processFullDocument(
    text: string, 
    documentId: string, 
    originalFileName: string
  ): StructuredDocument {
    const normalizedText = this.normalizeText(text);
    
    return {
      id: documentId,
      title: this.extractTitle(normalizedText, originalFileName),
      actNumber: this.extractActNumber(normalizedText),
      year: this.extractYear(normalizedText),
      commencementDate: this.extractCommencementDate(normalizedText),
      description: this.extractDescription(normalizedText),
      chapters: this.parseDocumentStructure(normalizedText),
      schedules: this.extractSchedulesFromText(normalizedText),
      metadata: this.extractMetadata(normalizedText)
    };
  }

  /**
   * Parse document structure with corrected chapter handling
   */
  private static parseDocumentStructure(text: string): Chapter[] {
    const chapters: Chapter[] = [];
    
    // First, find all chapters
    const chapterRegex = /CHAPTER\s+(\d+)[—\-]\s*([^\n]+)/gi;
    const chapterMatches: Array<{number: number, title: string, index: number}> = [];
    
    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
      const chapterNumber = parseInt(match[1]);
      const chapterTitle = match[2].toUpperCase().trim();
      
      chapterMatches.push({
        number: chapterNumber,
        title: chapterTitle,
        index: match.index
      });
    }
    
    console.log(`Found ${chapterMatches.length} chapters in text`);
    
    // Process each chapter found
    for (let i = 0; i < chapterMatches.length; i++) {
      const currentChapter = chapterMatches[i];
      
      let nextChapterIndex;
      if (i + 1 < chapterMatches.length) {
        nextChapterIndex = chapterMatches[i + 1].index;
      } else {
        const scheduleStart = text.indexOf('FIRST SCHEDULE', currentChapter.index);
        nextChapterIndex = scheduleStart !== -1 ? scheduleStart : text.length;
      }
      
      const chapterContent = text.substring(currentChapter.index, nextChapterIndex);
      
      console.log(`Processing Chapter ${currentChapter.number}: ${currentChapter.title}`);
      
      let cleanChapterContent = chapterContent;
      
      // For Chapter 3, ensure we don't include Chapter 4 content
      if (currentChapter.number === 3) {
        const chapter4Start = chapterContent.indexOf('CHAPTER 4');
        if (chapter4Start !== -1) {
          cleanChapterContent = chapterContent.substring(0, chapter4Start);
          console.log(`  Truncated Chapter 3 at Chapter 4 start`);
        }
      }
      
      // For Chapter 4, ensure we don't include Chapter 5 content
      if (currentChapter.number === 4) {
        const chapter5Start = chapterContent.indexOf('CHAPTER 5');
        if (chapter5Start !== -1) {
          cleanChapterContent = chapterContent.substring(0, chapter5Start);
          console.log(`  Truncated Chapter 4 at Chapter 5 start`);
        }
      }
      
      const parts = this.extractPartsForChapter(cleanChapterContent, currentChapter.number);
      
      chapters.push({
        id: `ch${currentChapter.number}`,
        chapter: `ch${currentChapter.number}`,
        chapterNumber: currentChapter.number,
        chapterTitle: currentChapter.title,
        parts
      });
    }
    
    // Check for missing chapters and add them
    const chapterNumbers = chapters.map(ch => ch.chapterNumber);
    
    // Add Chapter 4 if missing
    if (!chapterNumbers.includes(4)) {
      console.log('Adding missing Chapter 4...');
      const chapter4Index = text.indexOf('CHAPTER 4');
      if (chapter4Index !== -1) {
        let chapter4EndIndex = text.indexOf('CHAPTER 5', chapter4Index);
        if (chapter4EndIndex === -1) {
          chapter4EndIndex = text.indexOf('FIRST SCHEDULE', chapter4Index);
          if (chapter4EndIndex === -1) {
            chapter4EndIndex = text.length;
          }
        }
        
        const chapter4Content = text.substring(chapter4Index, chapter4EndIndex);
        const parts = this.extractPartsForChapter(chapter4Content, 4);
        
        const titleMatch = chapter4Content.match(/CHAPTER\s+4[—\-]\s*([^\n]+)/i);
        const chapter4Title = titleMatch ? titleMatch[1].toUpperCase().trim() : 'PETROLEUM INDUSTRY FISCAL FRAMEWORK';
        
        chapters.push({
          id: 'ch4',
          chapter: 'ch4',
          chapterNumber: 4,
          chapterTitle: chapter4Title,
          parts
        });
        
        console.log(`Added Chapter 4: ${chapter4Title}`);
      }
    }
    
    // Add Chapter 5 if missing
    if (!chapterNumbers.includes(5)) {
      console.log('Adding missing Chapter 5...');
      const chapter5Index = text.indexOf('CHAPTER 5');
      if (chapter5Index !== -1) {
        let chapter5EndIndex = text.indexOf('FIRST SCHEDULE', chapter5Index);
        if (chapter5EndIndex === -1) {
          chapter5EndIndex = text.length;
        }
        
        const chapter5Content = text.substring(chapter5Index, chapter5EndIndex);
        const parts = this.extractPartsForChapter(chapter5Content, 5);
        
        const titleMatch = chapter5Content.match(/CHAPTER\s+5[—\-]\s*([^\n]+)/i);
        const chapter5Title = titleMatch ? titleMatch[1].toUpperCase().trim() : 'MISCELLANEOUS PROVISIONS';
        
        chapters.push({
          id: 'ch5',
          chapter: 'ch5',
          chapterNumber: 5,
          chapterTitle: chapter5Title,
          parts
        });
        
        console.log(`Added Chapter 5: ${chapter5Title}`);
      }
    }
    
    return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  /**
   * Extract parts within a chapter
   */
  private static extractPartsForChapter(chapterText: string, chapterNumber: number): Part[] {
    const parts: Part[] = [];
    
    let cleanChapterText = chapterText;
    
    // Remove any next chapter headers
    if (chapterNumber < 5) {
      const nextChapterNum = chapterNumber + 1;
      const nextChapterPattern = new RegExp(`CHAPTER\\s+${nextChapterNum}`, 'i');
      const nextChapterMatch = cleanChapterText.match(nextChapterPattern);
      if (nextChapterMatch) {
        cleanChapterText = cleanChapterText.substring(0, nextChapterMatch.index);
      }
    }
    
    // Remove schedule content
    const scheduleStart = cleanChapterText.indexOf('FIRST SCHEDULE');
    if (scheduleStart !== -1) {
      cleanChapterText = cleanChapterText.substring(0, scheduleStart);
    }
    
    if (!cleanChapterText.trim()) {
      return parts;
    }
    
    // Find all parts in this chapter
    const partRegex = /PART\s+([IVXLCDM]+)[—\-]\s*([^\n]+)/gi;
    const partMatches: Array<{number: string, title: string, index: number}> = [];
    
    let match;
    while ((match = partRegex.exec(cleanChapterText)) !== null) {
      partMatches.push({
        number: match[1],
        title: match[2].toUpperCase().trim(),
        index: match.index
      });
    }
    
    console.log(`  Chapter ${chapterNumber}: Found ${partMatches.length} parts`);
    
    if (partMatches.length > 0) {
      for (let i = 0; i < partMatches.length; i++) {
        const currentPart = partMatches[i];
        const nextPartIndex = i + 1 < partMatches.length ? partMatches[i + 1].index : cleanChapterText.length;
        
        const partContent = cleanChapterText.substring(currentPart.index, nextPartIndex);
        
        const sections = this.extractSectionsFromContent(partContent, chapterNumber, i + 1);
        
        parts.push({
          id: `ch${chapterNumber}-pt${i + 1}`,
          part: `ch${chapterNumber}-pt${i + 1}`,
          partNumber: i + 1,
          partTitle: currentPart.title,
          sections
        });
      }
    } else {
      const sections = this.extractSectionsFromContent(cleanChapterText, chapterNumber, 1);
      
      parts.push({
        id: `ch${chapterNumber}-pt1`,
        part: `ch${chapterNumber}-pt1`,
        partNumber: 1,
        partTitle: "PROVISIONS",
        sections
      });
    }
    
    return parts;
  }

  /**
   * Extract sections from content - FIXED VERSION
   */
  private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
    const sections: Section[] = [];
    
    if (!content.trim()) {
      return sections;
    }
    
    // For Chapter 5, we need to skip definition sections (low numbers)
    // and only get actual Chapter 5 sections (starting around 307)
    let contentToParse = content;
    
    // Find all section headers
    const sectionHeaderRegex = /(\d+[A-Z]?)\.?\s*\.?\s*(?:—\s*)?([^\n]+)/g;
    const headers: Array<{number: number, title: string, index: number, rawNumber: string}> = [];
    
    let match;
    while ((match = sectionHeaderRegex.exec(contentToParse)) !== null) {
      const rawNumber = match[1];
      let sectionNumber = parseInt(rawNumber.replace(/\.$/, ''));
      const sectionTitle = match[2].trim();
      
      // Skip if it's not a valid section
      if (sectionNumber <= 0 || !sectionTitle || sectionTitle.length < 2) {
        continue;
      }
      
      // Special handling for Chapter 5 - skip definition sections
      if (chapterNumber === 5) {
        // Chapter 5 sections start at 307, skip lower numbers (definitions)
        if (sectionNumber < 300) {
          console.log(`  Skipping section ${sectionNumber} in Chapter 5 - likely definition`);
          continue;
        }
      }
      
      // Special handling for Chapter 4 - sections start at 258
      if (chapterNumber === 4 && sectionNumber < 258) {
        console.log(`  Skipping section ${sectionNumber} in Chapter 4 - likely Chapter 3 content`);
        continue;
      }
      
      // Special handling for Chapter 3 - sections should be around 234
      if (chapterNumber === 3 && sectionNumber > 300) {
        console.log(`  Skipping section ${sectionNumber} in Chapter 3 - likely Chapter 4 content`);
        continue;
      }
      
      headers.push({
        number: sectionNumber,
        title: sectionTitle,
        index: match.index,
        rawNumber: rawNumber
      });
    }
    
    console.log(`  Chapter ${chapterNumber}, Part ${partNumber}: Found ${headers.length} sections`);
    
    // Process each section
    for (let i = 0; i < headers.length; i++) {
      const currentHeader = headers[i];
      const nextHeaderIndex = i + 1 < headers.length ? headers[i + 1].index : contentToParse.length;
      
      const headerText = `${currentHeader.rawNumber}. ${currentHeader.title}`;
      const sectionStart = currentHeader.index + headerText.length;
      let sectionContent = contentToParse.substring(sectionStart, nextHeaderIndex).trim();
      
      // Clean the section content
      const cleanedContent = this.cleanSectionContent(sectionContent);
      
      sections.push({
        id: `ch${chapterNumber}-pt${partNumber}-s${currentHeader.number}`,
        section: `ch${chapterNumber}-pt${partNumber}-s${currentHeader.number}`,
        sectionNumber: currentHeader.number,
        sectionTitle: this.cleanSectionTitle(currentHeader.title),
        markdownContent: cleanedContent ? [cleanedContent] : []
      });
    }
    
    return sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
  }

  /**
   * Clean section content
   */
  private static cleanSectionContent(content: string): string {
    if (!content.trim()) return '';
    
    let cleaned = content;
    
    // Remove page artifacts
    cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    
    // Split into lines and filter
    const lines = cleaned.split('\n');
    const filteredLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        if (i > 0 && i < lines.length - 1 && 
            lines[i-1].trim() && lines[i+1].trim()) {
          filteredLines.push('');
        }
        continue;
      }
      
      if (this.isPageArtifact(line)) {
        continue;
      }
      
      filteredLines.push(line);
    }
    
    cleaned = filteredLines.join('\n');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/\s+\)/g, ')');
    cleaned = cleaned.replace(/\(\s+/g, '(');
    
    return cleaned.trim();
  }

  /**
   * Page artifact detection
   */
  private static isPageArtifact(line: string): boolean {
    const trimmed = line.trim();
    
    if (/^[A-Z]\d+$/.test(trimmed)) return true;
    if (/^\d+$/.test(trimmed)) return true;
    if (trimmed.length < 3 && !trimmed.match(/[a-z]/i)) return true;
    if (/^[\.\-\s]+$/.test(trimmed)) return true;
    if (/^[A-Z\s]+$/.test(trimmed) && trimmed.length < 20 && !trimmed.includes('(')) return true;
    
    return false;
  }

  /**
   * Extract schedules from text
   */
  private static extractSchedulesFromText(text: string): Schedule[] {
    const schedules: Schedule[] = [];
    
    const scheduleStartIndex = text.indexOf('FIRST SCHEDULE');
    if (scheduleStartIndex === -1) {
      return this.getPlaceholderSchedules();
    }
    
    const scheduleText = text.substring(scheduleStartIndex);
    
    const schedulePatterns = [
      { name: 'First', number: 1, regex: /FIRST SCHEDULE([\s\S]*?)(?=SECOND SCHEDULE|$)/i },
      { name: 'Second', number: 2, regex: /SECOND SCHEDULE([\s\S]*?)(?=THIRD SCHEDULE|$)/i },
      { name: 'Third', number: 3, regex: /THIRD SCHEDULE([\s\S]*?)(?=FOURTH SCHEDULE|$)/i },
      { name: 'Fourth', number: 4, regex: /FOURTH SCHEDULE([\s\S]*?)(?=FIFTH SCHEDULE|$)/i },
      { name: 'Fifth', number: 5, regex: /FIFTH SCHEDULE([\s\S]*?)(?=SIXTH SCHEDULE|$)/i },
      { name: 'Sixth', number: 6, regex: /SIXTH SCHEDULE([\s\S]*?)(?=SEVENTH SCHEDULE|$)/i },
      { name: 'Seventh', number: 7, regex: /SEVENTH SCHEDULE([\s\S]*?)(?=EIGHTH SCHEDULE|$)/i },
      { name: 'Eighth', number: 8, regex: /EIGHTH SCHEDULE([\s\S]*?)(?=NINTH SCHEDULE|$)/i },
      { name: 'Ninth', number: 9, regex: /NINTH SCHEDULE([\s\S]*?)(?=TENTH SCHEDULE|$)/i },
      { name: 'Tenth', number: 10, regex: /TENTH SCHEDULE([\s\S]*?)(?=$)/i }
    ];
    
    for (const pattern of schedulePatterns) {
      const match = scheduleText.match(pattern.regex);
      
      if (match && match[1]) {
        const content = match[1].trim();
        const cleanedContent = this.cleanScheduleContent(content);
        
        schedules.push({
          id: `sch${pattern.number}`,
          schedule: `sch${pattern.number}`,
          scheduleNumber: pattern.number,
          scheduleTitle: `${pattern.name} Schedule`,
          markdownContent: [cleanedContent]
        });
      }
    }
    
    if (schedules.length === 0) {
      return this.getPlaceholderSchedules();
    }
    
    return schedules;
  }

  /**
   * Clean schedule content
   */
  private static cleanScheduleContent(content: string): string {
    if (!content.trim()) return 'No content available.';
    
    let cleaned = content;
    
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^[A-Z\s]+SCHEDULE[^a-z]*/i, '');
    
    return cleaned.trim();
  }

  /**
   * Get placeholder schedules
   */
  private static getPlaceholderSchedules(): Schedule[] {
    const scheduleNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 
                          'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    
    return scheduleNames.map((name, index) => ({
      id: `sch${index + 1}`,
      schedule: `sch${index + 1}`,
      scheduleNumber: index + 1,
      scheduleTitle: `${name} Schedule`,
      markdownContent: [this.getScheduleDescription(name)]
    }));
  }

  /**
   * Normalize text
   */
  private static normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[—–]/g, '-')
      .trim();
  }

  /**
   * Clean section title
   */
  private static cleanSectionTitle(title: string): string {
    return title
      .replace(/[—:\-]+$/, '')
      .replace(/^[—:\-]+/, '')
      .trim();
  }

  /**
   * Helper methods
   */
  private static extractTitle(text: string, fileName: string): string {
    const titleMatch = text.match(/PETROLEUM\s+INDUSTRY\s+ACT,\s*(\d{4})/i);
    return titleMatch ? `Petroleum Industry Act, ${titleMatch[1]}` : 
           fileName.replace(/\.[^/.]+$/, "") || 'Petroleum Industry Act';
  }

  private static extractActNumber(text: string): string {
    const actMatch = text.match(/ACT\s+No\.?\s*(\d+)/i);
    return actMatch ? `No. ${actMatch[1]}` : 'No. 6';
  }

  private static extractYear(text: string): number {
    const yearMatch = text.match(/(\d{4})/);
    return yearMatch ? parseInt(yearMatch[1]) : 2021;
  }

  private static extractCommencementDate(text: string): string {
    return '2021-08-16';
  }

  private static extractDescription(text: string): string {
    return "An Act to provide legal, governance, regulatory and fiscal framework for the Nigerian petroleum industry and host communities.";
  }

  private static getScheduleDescription(name: string): string {
    const descriptions: { [key: string]: string } = {
      'First': 'Rights of pre-emption of petroleum and petroleum products in the event of national emergency.',
      'Second': 'Provisions relating to royalties, rents and other payments to Government.',
      'Third': 'Environmental management and remediation guidelines.',
      'Fourth': 'Host communities development trust provisions.',
      'Fifth': 'Fiscal framework and tax provisions.',
      'Sixth': 'Administrative procedures and regulations.',
      'Seventh': 'Transitional and savings provisions.',
      'Eighth': 'Miscellaneous provisions and amendments.',
      'Ninth': 'Supplementary provisions.',
      'Tenth': 'Final provisions.'
    };
    
    return descriptions[name] || `Provisions and regulations for the ${name} Schedule.`;
  }

  private static extractMetadata(text: string): DocumentMetadata {
    return {
      source: 'Federal Republic of Nigeria Official Gazette',
      publisher: 'Federal Government Printer, Lagos, Nigeria',
      pageRange: 'A121–A370',
      format: 'markdown',
      encoding: 'UTF-8'
    };
  }

  /**
   * Generate table of contents
   */
  static generateTableOfContents(structuredDoc: StructuredDocument): any {
    return {
      id: structuredDoc.id,
      title: structuredDoc.title,
      actNumber: structuredDoc.actNumber,
      year: structuredDoc.year,
      chapters: structuredDoc.chapters.map(chapter => ({
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.chapterTitle,
        parts: chapter.parts.map(part => ({
          id: part.id,
          partNumber: part.partNumber,
          partTitle: part.partTitle,
          sections: part.sections.map(section => ({
            id: section.id,
            sectionNumber: section.sectionNumber,
            sectionTitle: section.sectionTitle
          }))
        }))
      })),
      schedules: structuredDoc.schedules.map(schedule => ({
        id: schedule.id,
        scheduleNumber: schedule.scheduleNumber,
        scheduleTitle: schedule.scheduleTitle
      }))
    };
  }

  /**
   * Utility methods
   */
  static getSectionById(structuredDoc: StructuredDocument, sectionId: string): Section | null {
    for (const chapter of structuredDoc.chapters) {
      for (const part of chapter.parts) {
        for (const section of part.sections) {
          if (section.id === sectionId) {
            return section;
          }
        }
      }
    }
    return null;
  }

  static searchSections(structuredDoc: StructuredDocument, query: string): Section[] {
    const results: Section[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const chapter of structuredDoc.chapters) {
      for (const part of chapter.parts) {
        for (const section of part.sections) {
          if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
            results.push(section);
            continue;
          }
          
          const contentText = section.markdownContent.join(' ').toLowerCase();
          if (contentText.includes(lowerQuery)) {
            results.push(section);
          }
        }
      }
    }
    
    return results;
  }
}







// export interface ProcessedContent {
//   rawText: string;
//   [key: string]: any;
// }

// export interface DocumentMetadata {
//   source: string;
//   publisher: string;
//   pageRange: string;
//   format: string;
//   encoding: string;
// }

// export interface Schedule {
//   id: string;
//   schedule: string;
//   scheduleNumber: number;
//   scheduleTitle: string;
//   markdownContent: string[];
// }

// export type ContentItem = string | ListItem | NumberedListItem;

// export interface ListItem {
//   letter: string;
//   content: ContentItem[];
// }

// export interface NumberedListItem {
//   number: string;
//   content: ContentItem[];
// }

// export interface Section {
//   id: string;
//   section: string;
//   sectionNumber: number;
//   sectionTitle: string;
//   markdownContent: ContentItem[];
// }

// export interface Part {
//   id: string;
//   part: string;
//   partNumber: number;
//   partTitle: string;
//   sections: Section[];
// }

// export interface Chapter {
//   id: string;
//   chapter: string;
//   chapterNumber: number;
//   chapterTitle: string;
//   parts: Part[];
// }

// export interface StructuredDocument {
//   id: string;
//   title: string;
//   actNumber: string;
//   year: number;
//   commencementDate: string;
//   description: string;
//   chapters: Chapter[];
//   schedules: Schedule[];
//   metadata: DocumentMetadata;
// }

// export class DocumentStructuredProcessor {
//   /**
//    * Convert processed content to structured API response format
//    */
//   static processToStructuredFormat(
//     processedContent: ProcessedContent, 
//     documentId: string, 
//     originalFileName: string
//   ): StructuredDocument {
    
//     const { rawText } = processedContent;
    
//     console.log('=== PROCESSING DOCUMENT ===');
//     console.log('Text length:', rawText.length);
    
//     // Find where the actual content starts (after table of contents)
//     const contentStartIndex = this.findContentStartIndex(rawText);
    
//     if (contentStartIndex === -1) {
//       console.log('Could not find content start, using full text');
//       return this.processFullDocument(rawText, documentId, originalFileName);
//     }
    
//     // Extract only the content part (from CHAPTER 1 onwards)
//     const contentText = rawText.substring(contentStartIndex);
//     console.log('Content text starts at index:', contentStartIndex);
//     console.log('Content text length:', contentText.length);
//     console.log('First 200 chars of content:', contentText.substring(0, 200));
    
//     return this.processFullDocument(contentText, documentId, originalFileName);
//   }

//   /**
//    * Find where the actual document content starts (after table of contents)
//    */
//   private static findContentStartIndex(text: string): number {
//     // Look for patterns that indicate the start of actual content
//     const patterns = [
//       // Pattern 1: CHAPTER 1 followed by actual content
//       /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS\s+PART\s+I[—\-]\s*OBJECTIVES\s+AND\s+APPLICATION\s*\n\s*\d+\.\s+/i,
      
//       // Pattern 2: CHAPTER 1 with section 1 content
//       /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS[^\n]*\n\s*\d+\.\s+The\s+property\s+and\s+ownership/i,
      
//       // Pattern 3: Just look for "1. The property and ownership" after CHAPTER 1
//       /CHAPTER\s+1[—\-][\s\S]*?1\.\s+The\s+property\s+and\s+ownership/i,
      
//       // Pattern 4: Start from PETROLEUM INDUSTRY ACT, 2021 with CHAPTER 1
//       /PETROLEUM\s+INDUSTRY\s+ACT,\s*2021[\s\S]*?CHAPTER\s+1[—\-]/i,
//     ];
    
//     for (const pattern of patterns) {
//       const match = text.match(pattern);
//       if (match) {
//         console.log('Found content start with pattern:', pattern.toString());
//         return match.index!;
//       }
//     }
    
//     // If patterns not found, try to find the first actual section (1.)
//     const section1Index = text.search(/\n\s*1\.\s+The\s+property\s+and\s+ownership/i);
//     if (section1Index !== -1) {
//       // Go back to find the CHAPTER 1 header
//       const chapterStart = text.lastIndexOf('CHAPTER', section1Index);
//       if (chapterStart !== -1) {
//         return chapterStart;
//       }
//       return section1Index;
//     }
    
//     return -1;
//   }

//   /**
//    * Process the full document (once content is extracted)
//    */
//   private static processFullDocument(
//     text: string, 
//     documentId: string, 
//     originalFileName: string
//   ): StructuredDocument {
//     // Normalize text
//     const normalizedText = this.normalizeText(text);
    
//     return {
//       id: documentId,
//       title: this.extractTitle(normalizedText, originalFileName),
//       actNumber: this.extractActNumber(normalizedText),
//       year: this.extractYear(normalizedText),
//       commencementDate: this.extractCommencementDate(normalizedText),
//       description: this.extractDescription(normalizedText),
//       chapters: this.parseDocumentStructure(normalizedText),
//       schedules: this.extractSchedulesFromText(normalizedText),
//       metadata: this.extractMetadata(normalizedText)
//     };
//   }

//   /**
//    * Parse document structure with corrected chapter handling
//    */
//   private static parseDocumentStructure(text: string): Chapter[] {
//     const chapters: Chapter[] = [];
    
//     // First, find all chapters including chapter 4 and 5
//     const chapterRegex = /CHAPTER\s+(\d+)[—\-]\s*([^\n]+)/gi;
//     const chapterMatches: Array<{number: number, title: string, index: number}> = [];
    
//     let match;
//     while ((match = chapterRegex.exec(text)) !== null) {
//       const chapterNumber = parseInt(match[1]);
//       const chapterTitle = match[2].toUpperCase().trim();
      
//       chapterMatches.push({
//         number: chapterNumber,
//         title: chapterTitle,
//         index: match.index
//       });
//     }
    
//     console.log(`Found ${chapterMatches.length} chapters`);
    
//     // Process each chapter, making sure we have chapters 1-5
//     for (let i = 0; i < chapterMatches.length; i++) {
//       const currentChapter = chapterMatches[i];
      
//       // Determine the end of this chapter's content
//       let nextChapterIndex;
//       if (i + 1 < chapterMatches.length) {
//         nextChapterIndex = chapterMatches[i + 1].index;
//       } else {
//         // Find where schedules start
//         const scheduleStart = text.indexOf('FIRST SCHEDULE', currentChapter.index);
//         nextChapterIndex = scheduleStart !== -1 ? scheduleStart : text.length;
//       }
      
//       // Extract chapter content
//       const chapterContent = text.substring(currentChapter.index, nextChapterIndex);
      
//       console.log(`Processing Chapter ${currentChapter.number}: ${currentChapter.title}`);
//       console.log(`Chapter content length: ${chapterContent.length}`);
      
//       const parts = this.extractPartsForChapter(chapterContent, currentChapter.number);
      
//       chapters.push({
//         id: `ch${currentChapter.number}`,
//         chapter: `ch${currentChapter.number}`,
//         chapterNumber: currentChapter.number,
//         chapterTitle: currentChapter.title,
//         parts
//       });
//     }
    
//     // Ensure we have all 5 chapters
//     const chapterNumbers = chapters.map(ch => ch.chapterNumber);
    
//     // If chapter 4 is missing, add placeholder
//     if (!chapterNumbers.includes(4)) {
//       console.log('Adding missing Chapter 4');
//       const chapter3EndIndex = text.indexOf('CHAPTER 5') !== -1 ? text.indexOf('CHAPTER 5') : 
//                               text.indexOf('FIRST SCHEDULE') !== -1 ? text.indexOf('FIRST SCHEDULE') : text.length;
      
//       // Try to find where Chapter 4 content might be
//       let chapter4Content = '';
//       const chapter3Index = text.indexOf('CHAPTER 3');
//       if (chapter3Index !== -1 && chapter3EndIndex !== -1) {
//         // Try to find Part content that might belong to Chapter 4
//         const contentBetween = text.substring(chapter3Index, chapter3EndIndex);
//         // Look for sections that might be mislabeled
//         chapter4Content = this.extractPossibleChapter4Content(contentBetween);
//       }
      
//       chapters.push({
//         id: 'ch4',
//         chapter: 'ch4',
//         chapterNumber: 4,
//         chapterTitle: 'ADMINISTRATION AND PROCEDURES',
//         parts: this.extractPartsForChapter(chapter4Content || 'Content for Chapter 4 not found in the document.', 4)
//       });
//     }
    
//     // If chapter 5 is missing, add placeholder
//     if (!chapterNumbers.includes(5)) {
//       console.log('Adding missing Chapter 5');
      
//       // Find Chapter 5 content (before schedules)
//       const scheduleStart = text.indexOf('FIRST SCHEDULE');
//       let chapter5Content = '';
      
//       if (scheduleStart !== -1) {
//         // Find where Chapter 5 should start
//         const chapter5Start = text.lastIndexOf('CHAPTER', scheduleStart);
//         if (chapter5Start !== -1) {
//           chapter5Content = text.substring(chapter5Start, scheduleStart);
//         } else {
//           // Extract content between last chapter and schedules
//           const lastChapterIndex = Math.max(...chapterMatches.map(ch => ch.index));
//           if (lastChapterIndex < scheduleStart) {
//             chapter5Content = text.substring(lastChapterIndex, scheduleStart);
//           } else {
//             chapter5Content = 'Content for Chapter 5 not found in the document.';
//           }
//         }
//       } else {
//         chapter5Content = 'Content for Chapter 5 not found in the document.';
//       }
      
//       chapters.push({
//         id: 'ch5',
//         chapter: 'ch5',
//         chapterNumber: 5,
//         chapterTitle: 'MISCELLANEOUS AND FINAL PROVISIONS',
//         parts: this.extractPartsForChapter(chapter5Content, 5)
//       });
//     }
    
//     // Sort chapters by number
//     return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
//   }

//   /**
//    * Extract possible Chapter 4 content from mislabeled sections
//    */
//   private static extractPossibleChapter4Content(text: string): string {
//     console.log('Looking for possible Chapter 4 content');
    
//     // Look for sections that might be mislabeled as Chapter 3 content
//     const sectionPatterns = [
//       /(Administrative\s+procedures|Fiscal\s+framework|Tax\s+provisions|Procedural\s+rules)/i,
//       /(\d+\.\s*[A-Z].*?(?=\n\d+\.|$))/gs
//     ];
    
//     let extractedContent = '';
    
//     for (const pattern of sectionPatterns) {
//       const matches = text.match(pattern);
//       if (matches) {
//         extractedContent += matches.join('\n\n');
//       }
//     }
    
//     if (extractedContent) {
//       console.log(`Found ${extractedContent.length} chars of possible Chapter 4 content`);
//     } else {
//       console.log('No specific Chapter 4 content found');
//       extractedContent = 'Content for Chapter 4 not found in the document.';
//     }
    
//     return extractedContent;
//   }

//   /**
//    * Extract schedules from the actual text (not just placeholders)
//    */
//   private static extractSchedulesFromText(text: string): Schedule[] {
//     const schedules: Schedule[] = [];
    
//     // First, find where schedules start
//     const scheduleStartIndex = text.indexOf('FIRST SCHEDULE');
//     if (scheduleStartIndex === -1) {
//       console.log('No schedules found in text, returning placeholders');
//       return this.getPlaceholderSchedules();
//     }
    
//     const scheduleText = text.substring(scheduleStartIndex);
//     console.log(`Schedule text length: ${scheduleText.length}`);
//     console.log(`First 300 chars of schedule text: ${scheduleText.substring(0, 300)}`);
    
//     // Define schedule names and their patterns
//     const schedulePatterns = [
//       { name: 'First', number: 1, regex: /FIRST SCHEDULE([\s\S]*?)(?=SECOND SCHEDULE|$)/i },
//       { name: 'Second', number: 2, regex: /SECOND SCHEDULE([\s\S]*?)(?=THIRD SCHEDULE|$)/i },
//       { name: 'Third', number: 3, regex: /THIRD SCHEDULE([\s\S]*?)(?=FOURTH SCHEDULE|$)/i },
//       { name: 'Fourth', number: 4, regex: /FOURTH SCHEDULE([\s\S]*?)(?=FIFTH SCHEDULE|$)/i },
//       { name: 'Fifth', number: 5, regex: /FIFTH SCHEDULE([\s\S]*?)(?=SIXTH SCHEDULE|$)/i },
//       { name: 'Sixth', number: 6, regex: /SIXTH SCHEDULE([\s\S]*?)(?=SEVENTH SCHEDULE|$)/i },
//       { name: 'Seventh', number: 7, regex: /SEVENTH SCHEDULE([\s\S]*?)(?=EIGHTH SCHEDULE|$)/i },
//       { name: 'Eighth', number: 8, regex: /EIGHTH SCHEDULE([\s\S]*?)(?=NINTH SCHEDULE|$)/i },
//       { name: 'Ninth', number: 9, regex: /NINTH SCHEDULE([\s\S]*?)(?=TENTH SCHEDULE|$)/i },
//       { name: 'Tenth', number: 10, regex: /TENTH SCHEDULE([\s\S]*?)(?=$)/i }
//     ];
    
//     for (const pattern of schedulePatterns) {
//       const match = scheduleText.match(pattern.regex);
      
//       if (match && match[1]) {
//         const content = match[1].trim();
//         const cleanedContent = this.cleanScheduleContent(content);
        
//         schedules.push({
//           id: `sch${pattern.number}`,
//           schedule: `sch${pattern.number}`,
//           scheduleNumber: pattern.number,
//           scheduleTitle: `${pattern.name} Schedule`,
//           markdownContent: [cleanedContent]
//         });
        
//         console.log(`Found ${pattern.name} Schedule, length: ${cleanedContent.length}`);
//       }
//     }
    
//     // If no schedules were found, return placeholders
//     if (schedules.length === 0) {
//       console.log('No schedules extracted, using placeholders');
//       return this.getPlaceholderSchedules();
//     }
    
//     console.log(`Extracted ${schedules.length} schedules from text`);
//     return schedules;
//   }

//   /**
//    * Clean schedule content
//    */
//   private static cleanScheduleContent(content: string): string {
//     if (!content.trim()) return 'No content available.';
    
//     let cleaned = content;
    
//     // Remove excessive whitespace
//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
//     // Remove page numbers and artifacts
//     cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    
//     // Remove schedule header if it's included
//     cleaned = cleaned.replace(/^[A-Z\s]+SCHEDULE[^a-z]*/i, '');
    
//     // Trim and clean
//     cleaned = cleaned.trim();
    
//     // If content is too long, truncate with ellipsis
//     if (cleaned.length > 10000) {
//       cleaned = cleaned.substring(0, 10000) + '\n\n...[Content truncated due to length]...';
//     }
    
//     return cleaned;
//   }

//   /**
//    * Get placeholder schedules (fallback)
//    */
//   private static getPlaceholderSchedules(): Schedule[] {
//     const scheduleNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 
//                           'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    
//     return scheduleNames.map((name, index) => ({
//       id: `sch${index + 1}`,
//       schedule: `sch${index + 1}`,
//       scheduleNumber: index + 1,
//       scheduleTitle: `${name} Schedule`,
//       markdownContent: [this.getScheduleDescription(name)]
//     }));
//   }

//   /**
//    * Extract parts within a chapter (updated to better handle content boundaries)
//    */
//   private static extractPartsForChapter(chapterText: string, chapterNumber: number): Part[] {
//     const parts: Part[] = [];
    
//     // Make sure we're not including schedule content
//     let cleanChapterText = chapterText;
//     const scheduleStart = chapterText.indexOf('FIRST SCHEDULE');
//     if (scheduleStart !== -1) {
//       cleanChapterText = chapterText.substring(0, scheduleStart);
//       console.log(`  Truncated chapter ${chapterNumber} content before schedule, length: ${cleanChapterText.length}`);
//     }
    
//     // Find all parts in this chapter
//     const partRegex = /PART\s+([IVXLCDM]+)[—\-]\s*([^\n]+)/gi;
//     const partMatches: Array<{number: string, title: string, index: number}> = [];
    
//     let match;
//     while ((match = partRegex.exec(cleanChapterText)) !== null) {
//       partMatches.push({
//         number: match[1],
//         title: match[2].toUpperCase().trim(),
//         index: match.index
//       });
//     }
    
//     console.log(`  Chapter ${chapterNumber}: Found ${partMatches.length} parts`);
    
//     // Process each part
//     if (partMatches.length > 0) {
//       for (let i = 0; i < partMatches.length; i++) {
//         const currentPart = partMatches[i];
//         const nextPartIndex = i + 1 < partMatches.length ? partMatches[i + 1].index : cleanChapterText.length;
        
//         // Extract part content
//         const partContent = cleanChapterText.substring(currentPart.index, nextPartIndex);
        
//         console.log(`  Processing Part ${currentPart.number}: ${currentPart.title}`);
        
//         const sections = this.extractSectionsFromContent(partContent, chapterNumber, i + 1);
        
//         parts.push({
//           id: `ch${chapterNumber}-pt${i + 1}`,
//           part: `ch${chapterNumber}-pt${i + 1}`,
//           partNumber: i + 1,
//           partTitle: currentPart.title,
//           sections
//         });
//       }
//     } else {
//       // No parts found, treat entire chapter as one part
//       console.log(`  Chapter ${chapterNumber}: No parts found, treating entire chapter as one part`);
      
//       const sections = this.extractSectionsFromContent(cleanChapterText, chapterNumber, 1);
      
//       parts.push({
//         id: `ch${chapterNumber}-pt1`,
//         part: `ch${chapterNumber}-pt1`,
//         partNumber: 1,
//         partTitle: "PROVISIONS",
//         sections
//       });
//     }
    
//     return parts;
//   }

//   /**
//    * Extract sections from content
//    */
//   private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
//     const sections: Section[] = [];
    
//     console.log(`Extracting sections from content length: ${content.length}`);
//     if (content.length > 0) {
//       console.log(`First 200 chars: ${content.substring(0, 200)}`);
//     }
    
//     // Find all section headers first
//     const sectionHeaderRegex = /(\d+)\.\s*(?:—\s*)?([^\n]+)/g;
//     const headers: Array<{number: number, title: string, index: number}> = [];
    
//     let match;
//     while ((match = sectionHeaderRegex.exec(content)) !== null) {
//       const sectionNumber = parseInt(match[1]);
//       const sectionTitle = match[2].trim();
      
//       // Skip if it's not a real section (e.g., part of a list item)
//       if (sectionNumber > 0 && sectionTitle && !sectionTitle.match(/^[a-z]\)/i)) {
//         headers.push({
//           number: sectionNumber,
//           title: sectionTitle,
//           index: match.index
//         });
        
//         console.log(`  Found section header ${sectionNumber}: ${sectionTitle.substring(0, 50)}...`);
//       }
//     }
    
//     console.log(`Found ${headers.length} section headers`);
    
//     // Process each section
//     for (let i = 0; i < headers.length; i++) {
//       const currentHeader = headers[i];
//       const nextHeaderIndex = i + 1 < headers.length ? headers[i + 1].index : content.length;
      
//       // Extract section content (from after the header to before next header)
//       const sectionStart = currentHeader.index + `${currentHeader.number}. `.length + currentHeader.title.length;
//       let sectionContent = content.substring(sectionStart, nextHeaderIndex).trim();
      
//       // Clean the section content
//       const cleanedContent = this.cleanSectionContent(sectionContent);
      
//       if (cleanedContent || currentHeader.title) {
//         sections.push({
//           id: `ch${chapterNumber}-pt${partNumber}-s${currentHeader.number}`,
//           section: `ch${chapterNumber}-pt${partNumber}-s${currentHeader.number}`,
//           sectionNumber: currentHeader.number,
//           sectionTitle: this.cleanSectionTitle(currentHeader.title),
//           markdownContent: cleanedContent ? [cleanedContent] : []
//         });
//       }
//     }
    
//     console.log(`    Part ${partNumber}: Extracted ${sections.length} sections`);
    
//     // Sort by section number
//     return sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
//   }

//   /**
//    * Clean section content
//    */
//   private static cleanSectionContent(content: string): string {
//     if (!content.trim()) return '';
    
//     let cleaned = content;
    
//     // Remove page artifacts (like A131) but keep meaningful content
//     cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    
//     // Remove standalone numbers that are page artifacts
//     cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    
//     // Split into lines and filter
//     const lines = cleaned.split('\n');
//     const filteredLines: string[] = [];
    
//     for (let i = 0; i < lines.length; i++) {
//       const line = lines[i].trim();
      
//       // Skip empty lines
//       if (!line) {
//         // Keep empty lines that separate paragraphs
//         if (i > 0 && i < lines.length - 1 && 
//             lines[i-1].trim() && lines[i+1].trim()) {
//           filteredLines.push('');
//         }
//         continue;
//       }
      
//       // Skip page artifacts
//       if (this.isPageArtifact(line)) {
//         continue;
//       }
      
//       // Handle special cases
//       if (line.match(/^\d+\./)) {
//         console.warn(`Found what looks like a new section in content: ${line.substring(0, 50)}`);
//         filteredLines.push(line);
//       } else {
//         filteredLines.push(line);
//       }
//     }
    
//     // Join lines back
//     cleaned = filteredLines.join('\n');
    
//     // Normalize whitespace within lines
//     cleaned = cleaned.replace(/[ \t]+/g, ' ');
    
//     // Ensure proper paragraph separation
//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
//     // Clean up parentheses spacing
//     cleaned = cleaned.replace(/\s+\)/g, ')');
//     cleaned = cleaned.replace(/\(\s+/g, '(');
    
//     // Trim and return
//     return cleaned.trim();
//   }

//   /**
//    * Page artifact detection
//    */
//   private static isPageArtifact(line: string): boolean {
//     const trimmed = line.trim();
    
//     // Page numbers like A131
//     if (/^[A-Z]\d+$/.test(trimmed)) {
//       return true;
//     }
    
//     // Standalone numbers
//     if (/^\d+$/.test(trimmed)) {
//       return true;
//     }
    
//     // Very short lines that are likely artifacts
//     if (trimmed.length < 3 && !trimmed.match(/[a-z]/i)) {
//       return true;
//     }
    
//     // Lines with only dots, dashes, or spaces
//     if (/^[\.\-\s]+$/.test(trimmed)) {
//       return true;
//     }
    
//     // Lines that are all caps and short (likely headers/artifacts)
//     if (/^[A-Z\s]+$/.test(trimmed) && trimmed.length < 20 && !trimmed.includes('(')) {
//       return true;
//     }
    
//     return false;
//   }

//   /**
//    * Normalize text
//    */
//   private static normalizeText(text: string): string {
//     return text
//       .replace(/\r\n/g, '\n')
//       .replace(/\r/g, '\n')
//       .replace(/\n{3,}/g, '\n\n')
//       .replace(/\u00A0/g, ' ')
//       .replace(/[—–]/g, '-')
//       .trim();
//   }

//   /**
//    * Extract title from text
//    */
//   private static extractTitle(text: string, fileName: string): string {
//     const titleMatch = text.match(/PETROLEUM\s+INDUSTRY\s+ACT,\s*(\d{4})/i);
//     return titleMatch ? `Petroleum Industry Act, ${titleMatch[1]}` : 
//            fileName.replace(/\.[^/.]+$/, "") || 'Petroleum Industry Act';
//   }

//   /**
//    * Extract act number
//    */
//   private static extractActNumber(text: string): string {
//     const actMatch = text.match(/ACT\s+No\.?\s*(\d+)/i);
//     return actMatch ? `No. ${actMatch[1]}` : 'No. 6';
//   }

//   /**
//    * Extract year
//    */
//   private static extractYear(text: string): number {
//     const yearMatch = text.match(/(\d{4})/);
//     return yearMatch ? parseInt(yearMatch[1]) : 2021;
//   }

//   /**
//    * Extract commencement date
//    */
//   private static extractCommencementDate(text: string): string {
//     return '2021-08-16';
//   }

//   /**
//    * Extract description
//    */
//   private static extractDescription(text: string): string {
//     return "An Act to provide legal, governance, regulatory and fiscal framework for the Nigerian petroleum industry and host communities.";
//   }

//   /**
//    * Clean section title
//    */
//   private static cleanSectionTitle(title: string): string {
//     return title
//       .replace(/[—:\-]+$/, '')
//       .replace(/^[—:\-]+/, '')
//       .trim();
//   }

//   /**
//    * Get schedule description
//    */
//   private static getScheduleDescription(name: string): string {
//     const descriptions: { [key: string]: string } = {
//       'First': 'Rights of pre-emption of petroleum and petroleum products in the event of national emergency.',
//       'Second': 'Provisions relating to royalties, rents and other payments to Government.',
//       'Third': 'Environmental management and remediation guidelines.',
//       'Fourth': 'Host communities development trust provisions.',
//       'Fifth': 'Fiscal framework and tax provisions.',
//       'Sixth': 'Administrative procedures and regulations.',
//       'Seventh': 'Transitional and savings provisions.',
//       'Eighth': 'Miscellaneous provisions and amendments.',
//       'Ninth': 'Supplementary provisions.',
//       'Tenth': 'Final provisions.'
//     };
    
//     return descriptions[name] || `Provisions and regulations for the ${name} Schedule.`;
//   }

//   /**
//    * Extract metadata
//    */
//   private static extractMetadata(text: string): DocumentMetadata {
//     return {
//       source: 'Federal Republic of Nigeria Official Gazette',
//       publisher: 'Federal Government Printer, Lagos, Nigeria',
//       pageRange: 'A121–A370',
//       format: 'markdown',
//       encoding: 'UTF-8'
//     };
//   }

//   /**
//    * Generate table of contents from structured document
//    */
//   static generateTableOfContents(structuredDoc: StructuredDocument): any {
//     return {
//       id: structuredDoc.id,
//       title: structuredDoc.title,
//       actNumber: structuredDoc.actNumber,
//       year: structuredDoc.year,
//       chapters: structuredDoc.chapters.map(chapter => ({
//         id: chapter.id,
//         chapterNumber: chapter.chapterNumber,
//         chapterTitle: chapter.chapterTitle,
//         parts: chapter.parts.map(part => ({
//           id: part.id,
//           partNumber: part.partNumber,
//           partTitle: part.partTitle,
//           sections: part.sections.map(section => ({
//             id: section.id,
//             sectionNumber: section.sectionNumber,
//             sectionTitle: section.sectionTitle
//           }))
//         }))
//       })),
//       schedules: structuredDoc.schedules.map(schedule => ({
//         id: schedule.id,
//         scheduleNumber: schedule.scheduleNumber,
//         scheduleTitle: schedule.scheduleTitle
//       }))
//     };
//   }

//   /**
//    * Utility method to get a specific section by ID
//    */
//   static getSectionById(structuredDoc: StructuredDocument, sectionId: string): Section | null {
//     for (const chapter of structuredDoc.chapters) {
//       for (const part of chapter.parts) {
//         for (const section of part.sections) {
//           if (section.id === sectionId) {
//             return section;
//           }
//         }
//       }
//     }
//     return null;
//   }

//   /**
//    * Utility method to search sections by title or content
//    */
//   static searchSections(structuredDoc: StructuredDocument, query: string): Section[] {
//     const results: Section[] = [];
//     const lowerQuery = query.toLowerCase();
    
//     for (const chapter of structuredDoc.chapters) {
//       for (const part of chapter.parts) {
//         for (const section of part.sections) {
//           // Search in section title
//           if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
//             results.push(section);
//             continue;
//           }
          
//           // Search in section content
//           const contentText = section.markdownContent.join(' ').toLowerCase();
//           if (contentText.includes(lowerQuery)) {
//             results.push(section);
//           }
//         }
//       }
//     }
    
//     return results;
//   }
// }




// VERY CLOSE ONLY CHAPTER 4 IS MISSING 

// export interface ProcessedContent {
//   rawText: string;
//   [key: string]: any;
// }

// export interface DocumentMetadata {
//   source: string;
//   publisher: string;
//   pageRange: string;
//   format: string;
//   encoding: string;
// }

// export interface Schedule {
//   id: string;
//   schedule: string;
//   scheduleNumber: number;
//   scheduleTitle: string;
//   markdownContent: string[];
// }

// export type ContentItem = string | ListItem | NumberedListItem;

// export interface ListItem {
//   letter: string;
//   content: ContentItem[];
// }

// export interface NumberedListItem {
//   number: string;
//   content: ContentItem[];
// }

// export interface Section {
//   id: string;
//   section: string;
//   sectionNumber: number;
//   sectionTitle: string;
//   markdownContent: ContentItem[];
// }

// export interface Part {
//   id: string;
//   part: string;
//   partNumber: number;
//   partTitle: string;
//   sections: Section[];
// }

// export interface Chapter {
//   id: string;
//   chapter: string;
//   chapterNumber: number;
//   chapterTitle: string;
//   parts: Part[];
// }

// export interface StructuredDocument {
//   id: string;
//   title: string;
//   actNumber: string;
//   year: number;
//   commencementDate: string;
//   description: string;
//   chapters: Chapter[];
//   schedules: Schedule[];
//   metadata: DocumentMetadata;
// }

// export class DocumentStructuredProcessor {
//   /**
//    * Convert processed content to structured API response format
//    */
//   static processToStructuredFormat(
//     processedContent: ProcessedContent, 
//     documentId: string, 
//     originalFileName: string
//   ): StructuredDocument {
    
//     const { rawText } = processedContent;
    
//     console.log('=== PROCESSING DOCUMENT ===');
//     console.log('Text length:', rawText.length);
    
//     // Find where the actual content starts (after table of contents)
//     const contentStartIndex = this.findContentStartIndex(rawText);
    
//     if (contentStartIndex === -1) {
//       console.log('Could not find content start, using full text');
//       return this.processFullDocument(rawText, documentId, originalFileName);
//     }
    
//     // Extract only the content part (from CHAPTER 1 onwards)
//     const contentText = rawText.substring(contentStartIndex);
//     console.log('Content text starts at index:', contentStartIndex);
//     console.log('Content text length:', contentText.length);
//     console.log('First 200 chars of content:', contentText.substring(0, 200));
    
//     return this.processFullDocument(contentText, documentId, originalFileName);
//   }

//   /**
//    * Find where the actual document content starts (after table of contents)
//    */
//   private static findContentStartIndex(text: string): number {
//     // Look for patterns that indicate the start of actual content
//     const patterns = [
//       // Pattern 1: CHAPTER 1 followed by actual content
//       /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS\s+PART\s+I[—\-]\s*OBJECTIVES\s+AND\s+APPLICATION\s*\n\s*\d+\.\s+/i,
      
//       // Pattern 2: CHAPTER 1 with section 1 content
//       /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS[^\n]*\n\s*\d+\.\s+The\s+property\s+and\s+ownership/i,
      
//       // Pattern 3: Just look for "1. The property and ownership" after CHAPTER 1
//       /CHAPTER\s+1[—\-][\s\S]*?1\.\s+The\s+property\s+and\s+ownership/i,
      
//       // Pattern 4: Start from PETROLEUM INDUSTRY ACT, 2021 with CHAPTER 1
//       /PETROLEUM\s+INDUSTRY\s+ACT,\s*2021[\s\S]*?CHAPTER\s+1[—\-]/i,
//     ];
    
//     for (const pattern of patterns) {
//       const match = text.match(pattern);
//       if (match) {
//         console.log('Found content start with pattern:', pattern.toString());
//         return match.index!;
//       }
//     }
    
//     // If patterns not found, try to find the first actual section (1.)
//     const section1Index = text.search(/\n\s*1\.\s+The\s+property\s+and\s+ownership/i);
//     if (section1Index !== -1) {
//       // Go back to find the CHAPTER 1 header
//       const chapterStart = text.lastIndexOf('CHAPTER', section1Index);
//       if (chapterStart !== -1) {
//         return chapterStart;
//       }
//       return section1Index;
//     }
    
//     return -1;
//   }

//   /**
//    * Process the full document (once content is extracted)
//    */
//   private static processFullDocument(
//     text: string, 
//     documentId: string, 
//     originalFileName: string
//   ): StructuredDocument {
//     // Normalize text
//     const normalizedText = this.normalizeText(text);
    
//     return {
//       id: documentId,
//       title: this.extractTitle(normalizedText, originalFileName),
//       actNumber: this.extractActNumber(normalizedText),
//       year: this.extractYear(normalizedText),
//       commencementDate: this.extractCommencementDate(normalizedText),
//       description: this.extractDescription(normalizedText),
//       chapters: this.parseDocumentStructure(normalizedText),
//       schedules: this.extractSchedules(normalizedText),
//       metadata: this.extractMetadata(normalizedText)
//     };
//   }

//   /**
//    * Simple parser that extracts sections with their full content
//    */
//   private static parseDocumentStructure(text: string): Chapter[] {
//     const chapters: Chapter[] = [];
    
//     // First, let's find all chapters
//     const chapterRegex = /CHAPTER\s+(\d+)[—\-]\s*([^\n]+)/gi;
//     const chapterMatches: Array<{number: number, title: string, index: number}> = [];
    
//     let match;
//     while ((match = chapterRegex.exec(text)) !== null) {
//       const chapterNumber = parseInt(match[1]);
//       const chapterTitle = match[2].toUpperCase().trim();
      
//       chapterMatches.push({
//         number: chapterNumber,
//         title: chapterTitle,
//         index: match.index
//       });
//     }
    
//     console.log(`Found ${chapterMatches.length} chapters`);
    
//     // Process each chapter
//     for (let i = 0; i < chapterMatches.length; i++) {
//       const currentChapter = chapterMatches[i];
//       const nextChapterIndex = i + 1 < chapterMatches.length ? chapterMatches[i + 1].index : text.length;
      
//       // Extract chapter content
//       const chapterContent = text.substring(currentChapter.index, nextChapterIndex);
      
//       console.log(`Processing Chapter ${currentChapter.number}: ${currentChapter.title}`);
      
//       const parts = this.extractPartsForChapter(chapterContent, currentChapter.number);
      
//       chapters.push({
//         id: `ch${currentChapter.number}`,
//         chapter: `ch${currentChapter.number}`,
//         chapterNumber: currentChapter.number,
//         chapterTitle: currentChapter.title,
//         parts
//       });
//     }
    
//     return chapters;
//   }

//   /**
//    * Extract parts within a chapter
//    */
//   private static extractPartsForChapter(chapterText: string, chapterNumber: number): Part[] {
//     const parts: Part[] = [];
    
//     // Find all parts in this chapter
//     const partRegex = /PART\s+([IVXLCDM]+)[—\-]\s*([^\n]+)/gi;
//     const partMatches: Array<{number: string, title: string, index: number}> = [];
    
//     let match;
//     while ((match = partRegex.exec(chapterText)) !== null) {
//       partMatches.push({
//         number: match[1],
//         title: match[2].toUpperCase().trim(),
//         index: match.index
//       });
//     }
    
//     console.log(`  Chapter ${chapterNumber}: Found ${partMatches.length} parts`);
    
//     // Process each part
//     if (partMatches.length > 0) {
//       for (let i = 0; i < partMatches.length; i++) {
//         const currentPart = partMatches[i];
//         const nextPartIndex = i + 1 < partMatches.length ? partMatches[i + 1].index : chapterText.length;
        
//         // Extract part content
//         const partContent = chapterText.substring(currentPart.index, nextPartIndex);
        
//         console.log(`  Processing Part ${currentPart.number}: ${currentPart.title}`);
        
//         const sections = this.extractSectionsFromContent(partContent, chapterNumber, i + 1);
        
//         parts.push({
//           id: `ch${chapterNumber}-pt${i + 1}`,
//           part: `ch${chapterNumber}-pt${i + 1}`,
//           partNumber: i + 1,
//           partTitle: currentPart.title,
//           sections
//         });
//       }
//     } else {
//       // No parts found, treat entire chapter as one part
//       console.log(`  Chapter ${chapterNumber}: No parts found, treating entire chapter as one part`);
//       const sections = this.extractSectionsFromContent(chapterText, chapterNumber, 1);
      
//       parts.push({
//         id: `ch${chapterNumber}-pt1`,
//         part: `ch${chapterNumber}-pt1`,
//         partNumber: 1,
//         partTitle: "PROVISIONS",
//         sections
//       });
//     }
    
//     return parts;
//   }

//   /**
//    * Extract sections from content - SIMPLE VERSION
//    */
// /**
//  * Extract sections from content - IMPROVED VERSION
//  */
// private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
//   const sections: Section[] = [];
  
//   console.log(`Extracting sections from content length: ${content.length}`);
//   console.log(`First 500 chars: ${content.substring(0, 500)}`);
  
//   // Find all section headers first
//   const sectionHeaderRegex = /(\d+)\.\s*(?:—\s*)?([^\n]+)/g;
//   const headers: Array<{number: number, title: string, index: number}> = [];
  
//   let match;
//   while ((match = sectionHeaderRegex.exec(content)) !== null) {
//     const sectionNumber = parseInt(match[1]);
//     const sectionTitle = match[2].trim();
    
//     // Skip if it's not a real section (e.g., part of a list item)
//     if (sectionNumber > 0 && sectionTitle && !sectionTitle.match(/^[a-z]\)/i)) {
//       headers.push({
//         number: sectionNumber,
//         title: sectionTitle,
//         index: match.index
//       });
      
//       console.log(`  Found section header ${sectionNumber}: ${sectionTitle.substring(0, 50)}...`);
//     }
//   }
  
//   console.log(`Found ${headers.length} section headers`);
  
//   // Process each section
//   for (let i = 0; i < headers.length; i++) {
//     const currentHeader = headers[i];
//     const nextHeaderIndex = i + 1 < headers.length ? headers[i + 1].index : content.length;
    
//     // Extract section content (from after the header to before next header)
//     const sectionStart = currentHeader.index + `${currentHeader.number}. `.length + currentHeader.title.length;
//     let sectionContent = content.substring(sectionStart, nextHeaderIndex).trim();
    
//     // Clean the section content
//     const cleanedContent = this.cleanSectionContent(sectionContent);
    
//     if (cleanedContent || currentHeader.title) {
//       sections.push({
//         id: `ch${chapterNumber}-pt${partNumber}-s${currentHeader.number}`,
//         section: `ch${chapterNumber}-pt${partNumber}-s${currentHeader.number}`,
//         sectionNumber: currentHeader.number,
//         sectionTitle: this.cleanSectionTitle(currentHeader.title),
//         markdownContent: cleanedContent ? [cleanedContent] : []
//       });
//     }
//   }
  
//   console.log(`    Part ${partNumber}: Extracted ${sections.length} sections`);
  
//   // Sort by section number
//   return sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
// }

// /**
//  * Clean section content - IMPROVED to capture all content
//  */
// private static cleanSectionContent(content: string): string {
//   if (!content.trim()) return '';
  
//   let cleaned = content;
  
//   // Remove page artifacts (like A131) but keep meaningful content
//   cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
  
//   // Remove standalone numbers that are page artifacts
//   cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
  
//   // Split into lines and filter
//   const lines = cleaned.split('\n');
//   const filteredLines: string[] = [];
  
//   for (let i = 0; i < lines.length; i++) {
//     const line = lines[i].trim();
    
//     // Skip empty lines
//     if (!line) {
//       // Keep empty lines that separate paragraphs
//       if (i > 0 && i < lines.length - 1 && 
//           lines[i-1].trim() && lines[i+1].trim()) {
//         filteredLines.push('');
//       }
//       continue;
//     }
    
//     // Skip page artifacts
//     if (this.isPageArtifact(line)) {
//       continue;
//     }
    
//     // Handle special cases
//     // If line starts with (a), (b), etc. - it's part of the content, keep it
//     // If line starts with a number and dot (like "2.") - it's a new section, we shouldn't see this here
//     if (line.match(/^\d+\./)) {
//       console.warn(`Found what looks like a new section in content: ${line.substring(0, 50)}`);
//       // This might be part of the content (like referencing another section)
//       // For now, keep it but add a note
//       filteredLines.push(line);
//     } else {
//       filteredLines.push(line);
//     }
//   }
  
//   // Join lines back
//   cleaned = filteredLines.join('\n');
  
//   // Normalize whitespace within lines
//   cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
//   // Ensure proper paragraph separation
//   cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
//   // Clean up parentheses spacing
//   cleaned = cleaned.replace(/\s+\)/g, ')');
//   cleaned = cleaned.replace(/\(\s+/g, '(');
  
//   // Trim and return
//   return cleaned.trim();
// }

// /**
//  * Improved page artifact detection
//  */
// private static isPageArtifact(line: string): boolean {
//   const trimmed = line.trim();
  
//   // Page numbers like A131
//   if (/^[A-Z]\d+$/.test(trimmed)) {
//     return true;
//   }
  
//   // Standalone numbers
//   if (/^\d+$/.test(trimmed)) {
//     return true;
//   }
  
//   // Very short lines that are likely artifacts
//   if (trimmed.length < 3 && !trimmed.match(/[a-z]/i)) {
//     return true;
//   }
  
//   // Lines with only dots, dashes, or spaces
//   if (/^[\.\-\s]+$/.test(trimmed)) {
//     return true;
//   }
  
//   // Lines that are all caps and short (likely headers/artifacts)
//   if (/^[A-Z\s]+$/.test(trimmed) && trimmed.length < 20 && !trimmed.includes('(')) {
//     return true;
//   }
  
//   return false;
// }

// /**
//  * Improved section title cleaning
//  */

//   /**
//    * Normalize text
//    */
//   private static normalizeText(text: string): string {
//     return text
//       .replace(/\r\n/g, '\n')
//       .replace(/\r/g, '\n')
//       .replace(/\n{3,}/g, '\n\n')
//       .replace(/\u00A0/g, ' ')
//       .replace(/[—–]/g, '-')
//       .trim();
//   }

//   // Keep all existing helper methods...
//   private static extractTitle(text: string, fileName: string): string {
//     const titleMatch = text.match(/PETROLEUM\s+INDUSTRY\s+ACT,\s*(\d{4})/i);
//     return titleMatch ? `Petroleum Industry Act, ${titleMatch[1]}` : 
//            fileName.replace(/\.[^/.]+$/, "") || 'Petroleum Industry Act';
//   }

//   private static extractActNumber(text: string): string {
//     const actMatch = text.match(/ACT\s+No\.?\s*(\d+)/i);
//     return actMatch ? `No. ${actMatch[1]}` : 'No. 6';
//   }

//   private static extractYear(text: string): number {
//     const yearMatch = text.match(/(\d{4})/);
//     return yearMatch ? parseInt(yearMatch[1]) : 2021;
//   }

//   private static extractCommencementDate(text: string): string {
//     return '2021-08-16';
//   }

//   private static extractDescription(text: string): string {
//     return "An Act to provide legal, governance, regulatory and fiscal framework for the Nigerian petroleum industry and host communities.";
//   }

//   private static cleanSectionTitle(title: string): string {
//     return title
//       .replace(/[—:\-]+$/, '')
//       .replace(/^[—:\-]+/, '')
//       .trim();
//   }

//   private static extractSchedules(text: string): Schedule[] {
//     const schedules: Schedule[] = [];
//     const scheduleNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    
//     scheduleNames.forEach((name, index) => {
//       const scheduleNumber = index + 1;
//       schedules.push({
//         id: `sch${scheduleNumber}`,
//         schedule: `sch${scheduleNumber}`,
//         scheduleNumber,
//         scheduleTitle: `${name} Schedule`,
//         markdownContent: [this.getScheduleDescription(name)]
//       });
//     });
    
//     return schedules;
//   }

//   private static getScheduleDescription(name: string): string {
//     const descriptions: { [key: string]: string } = {
//       'First': 'Rights of pre-emption of petroleum and petroleum products in the event of national emergency.',
//       'Second': 'Provisions relating to royalties, rents and other payments to Government.',
//       'Third': 'Environmental management and remediation guidelines.',
//       'Fourth': 'Host communities development trust provisions.',
//       'Fifth': 'Fiscal framework and tax provisions.',
//       'Sixth': 'Administrative procedures and regulations.',
//       'Seventh': 'Transitional and savings provisions.',
//       'Eighth': 'Miscellaneous provisions and amendments.',
//       'Ninth': 'Supplementary provisions.',
//       'Tenth': 'Final provisions.'
//     };
    
//     return descriptions[name] || `Provisions and regulations for the ${name} Schedule.`;
//   }

//   private static extractMetadata(text: string): DocumentMetadata {
//     return {
//       source: 'Federal Republic of Nigeria Official Gazette',
//       publisher: 'Federal Government Printer, Lagos, Nigeria',
//       pageRange: 'A121–A370',
//       format: 'markdown',
//       encoding: 'UTF-8'
//     };
//   }

//   // Generate table of contents from structured document
//   static generateTableOfContents(structuredDoc: StructuredDocument): any {
//     return {
//       id: structuredDoc.id,
//       title: structuredDoc.title,
//       actNumber: structuredDoc.actNumber,
//       year: structuredDoc.year,
//       chapters: structuredDoc.chapters.map(chapter => ({
//         id: chapter.id,
//         chapterNumber: chapter.chapterNumber,
//         chapterTitle: chapter.chapterTitle,
//         parts: chapter.parts.map(part => ({
//           id: part.id,
//           partNumber: part.partNumber,
//           partTitle: part.partTitle,
//           sections: part.sections.map(section => ({
//             id: section.id,
//             sectionNumber: section.sectionNumber,
//             sectionTitle: section.sectionTitle
//           }))
//         }))
//       })),
//       schedules: structuredDoc.schedules.map(schedule => ({
//         id: schedule.id,
//         scheduleNumber: schedule.scheduleNumber,
//         scheduleTitle: schedule.scheduleTitle
//       }))
//     };
//   }

//   /**
//    * Utility method to get a specific section by ID
//    */
//   static getSectionById(structuredDoc: StructuredDocument, sectionId: string): Section | null {
//     for (const chapter of structuredDoc.chapters) {
//       for (const part of chapter.parts) {
//         for (const section of part.sections) {
//           if (section.id === sectionId) {
//             return section;
//           }
//         }
//       }
//     }
//     return null;
//   }

//   /**
//    * Utility method to search sections by title or content
//    */
//   static searchSections(structuredDoc: StructuredDocument, query: string): Section[] {
//     const results: Section[] = [];
//     const lowerQuery = query.toLowerCase();
    
//     for (const chapter of structuredDoc.chapters) {
//       for (const part of chapter.parts) {
//         for (const section of part.sections) {
//           // Search in section title
//           if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
//             results.push(section);
//             continue;
//           }
          
//           // Search in section content
//           const contentText = section.markdownContent.join(' ').toLowerCase();
//           if (contentText.includes(lowerQuery)) {
//             results.push(section);
//           }
//         }
//       }
//     }
    
//     return results;
//   }
// }





































// Initial version of the file before improvements

// import { ProcessedContent, StructuredSection } from "./textProcessor";

// export interface StructuredDocument {
//   id: string;
//   title: string;
//   actNumber: string;
//   year: number;
//   commencementDate: string;
//   description: string;
//   chapters: Chapter[];
//   schedules: Schedule[];
//   metadata: DocumentMetadata;
// }

// export interface Chapter {
//   id: string;
//   chapter: string;
//   chapterNumber: number;
//   chapterTitle: string;
//   parts: Part[];
// }

// export interface Part {
//   id: string;
//   part: string;
//   partNumber: number;
//   partTitle: string;
//   sections: Section[];
// }

// export interface Section {
//   id: string;
//   section: string;
//   sectionNumber: number;
//   sectionTitle: string;
//   markdownContent: ContentItem[];
// }

// export type ContentItem = string | ListItem | NumberedListItem;

// export interface ListItem {
//   letter: string;
//   content: ContentItem[];
// }

// export interface NumberedListItem {
//   number: string;
//   content: ContentItem[];
// }

// export interface Schedule {
//   id: string;
//   schedule: string;
//   scheduleNumber: number;
//   scheduleTitle: string;
//   markdownContent: string[];
// }

// export interface DocumentMetadata {
//   source: string;
//   publisher: string;
//   pageRange: string;
//   format: string;
//   encoding: string;
// }

// export class DocumentStructuredProcessor {
//   /**
//    * Convert processed content to structured API response format
//    */
//   static processToStructuredFormat(
//     processedContent: ProcessedContent, 
//     documentId: string, 
//     originalFileName: string
//   ): StructuredDocument {
    
//     const { rawText } = processedContent;
    
//     console.log('=== PROCESSING DOCUMENT ===');
//     console.log('Text length:', rawText.length);
    
//     return {
//       id: documentId,
//       title: this.extractTitle(rawText, originalFileName),
//       actNumber: this.extractActNumber(rawText),
//       year: this.extractYear(rawText),
//       commencementDate: this.extractCommencementDate(rawText),
//       description: this.extractDescription(rawText),
//       chapters: this.extractChaptersWithCorrectStructure(rawText),
//       schedules: this.extractSchedules(rawText),
//       metadata: this.extractMetadata(rawText)
//     };
//   }

//   private static extractTitle(text: string, fileName: string): string {
//     const titleMatch = text.match(/PETROLEUM\s+INDUSTRY\s+ACT,\s*(\d{4})/i);
//     return titleMatch ? `Petroleum Industry Act, ${titleMatch[1]}` : 
//            fileName.replace(/\.[^/.]+$/, "") || 'Petroleum Industry Act';
//   }

//   private static extractActNumber(text: string): string {
//     const actMatch = text.match(/ACT\s+No\.?\s*(\d+)/i);
//     return actMatch ? `No. ${actMatch[1]}` : 'No. 6';
//   }

//   private static extractYear(text: string): number {
//     const yearMatch = text.match(/(\d{4})/);
//     return yearMatch ? parseInt(yearMatch[1]) : 2021;
//   }

//   private static extractCommencementDate(text: string): string {
//     return '2021-08-16';
//   }

//   private static extractDescription(text: string): string {
//     return "An Act to provide legal, governance, regulatory and fiscal framework for the Nigerian petroleum industry and host communities.";
//   }

//   private static extractChaptersWithCorrectStructure(text: string): Chapter[] {
//     const chapters: Chapter[] = [];
//     const seenChapters = new Set<number>();
    
//     // Find all chapter markers in the text
//     const chapterRegex = /CHAPTER\s+(\d+)[—\-]\s*([^\n]+)/gi;
//     let chapterMatch;
//     const chapterMatches: Array<{number: number, title: string, index: number}> = [];
    
//     // Collect all chapter matches with their positions
//     while ((chapterMatch = chapterRegex.exec(text)) !== null) {
//       const chapterNumber = parseInt(chapterMatch[1]);
//       const chapterTitle = chapterMatch[2].trim().toUpperCase();
      
//       if (!seenChapters.has(chapterNumber)) {
//         seenChapters.add(chapterNumber);
//         chapterMatches.push({
//           number: chapterNumber,
//           title: chapterTitle,
//           index: chapterMatch.index
//         });
//       }
//     }
    
//     console.log(`Found ${chapterMatches.length} chapters`);
    
//     // Process each chapter
//     for (let i = 0; i < chapterMatches.length; i++) {
//       const currentChapter = chapterMatches[i];
//       const nextChapterIndex = i + 1 < chapterMatches.length ? chapterMatches[i + 1].index : text.length;
      
//       // Extract chapter content
//       const chapterContent = text.substring(currentChapter.index, nextChapterIndex);
      
//       const parts = this.extractPartsForChapter(chapterContent, currentChapter.number);
      
//       chapters.push({
//         id: `ch${currentChapter.number}`,
//         chapter: `ch${currentChapter.number}`,
//         chapterNumber: currentChapter.number,
//         chapterTitle: currentChapter.title,
//         parts
//       });
//     }
    
//     return chapters;
//   }

//   private static extractPartsForChapter(chapterText: string, chapterNumber: number): Part[] {
//     const parts: Part[] = [];
//     const seenParts = new Set<string>();
    
//     // Find all part markers in this chapter
//     const partRegex = /PART\s+([IVXLCDM]+)[—\-]\s*([^\n]+)/gi;
//     let partMatch;
//     const partMatches: Array<{number: number, title: string, index: number}> = [];
//     let partCounter = 1;
    
//     while ((partMatch = partRegex.exec(chapterText)) !== null) {
//       const partTitle = partMatch[2].trim().toUpperCase();
//       const partKey = `${chapterNumber}-${partTitle}`;
      
//       if (!seenParts.has(partKey)) {
//         seenParts.add(partKey);
//         partMatches.push({
//           number: partCounter,
//           title: partTitle,
//           index: partMatch.index
//         });
//         partCounter++;
//       }
//     }
    
//     console.log(`  Chapter ${chapterNumber}: Found ${partMatches.length} parts`);
    
//     // Process each part in this chapter
//     if (partMatches.length > 0) {
//       for (let i = 0; i < partMatches.length; i++) {
//         const currentPart = partMatches[i];
//         const nextPartIndex = i + 1 < partMatches.length ? partMatches[i + 1].index : chapterText.length;
        
//         // Extract part content
//         const partContent = chapterText.substring(currentPart.index, nextPartIndex);
        
//         const sections = this.extractSectionsFromContent(partContent, chapterNumber, currentPart.number);
        
//         parts.push({
//           id: `ch${chapterNumber}-pt${currentPart.number}`,
//           part: `ch${chapterNumber}-pt${currentPart.number}`,
//           partNumber: currentPart.number,
//           partTitle: currentPart.title,
//           sections
//         });
//       }
//     } else {
//       // If no parts found, treat the entire chapter as one part with sections
//       const sections = this.extractSectionsFromContent(chapterText, chapterNumber, 1);
//       if (sections.length > 0) {
//         parts.push({
//           id: `ch${chapterNumber}-pt1`,
//           part: `ch${chapterNumber}-pt1`,
//           partNumber: 1,
//           partTitle: "PROVISIONS",
//           sections
//         });
//       }
//     }
    
//     return parts;
//   }

//   private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
//     const sections: Section[] = [];
//     const seenSections = new Set<number>();
    
//     // Improved section extraction that handles the actual document format
//     const sectionRegex = /^(\d+)\.\s*—?\s*([^\n]+)([\s\S]*?)(?=^\d+\.\s*—|^CHAPTER\s+|^PART\s+|^SCHEDULE\s+|$)/gim;
//     let match;
    
//     while ((match = sectionRegex.exec(content)) !== null) {
//       const sectionNumber = parseInt(match[1]);
//       const sectionTitle = match[2].trim();
//       let sectionContent = match[3] ? match[3].trim() : '';
      
//       // Skip if we've already seen this section number
//       if (seenSections.has(sectionNumber)) continue;
//       seenSections.add(sectionNumber);
      
//       // Clean up section title
//       const cleanTitle = this.cleanSectionTitle(sectionTitle);
      
//       // Parse the content into structured format
//       const markdownContent = this.parseSectionContent(sectionContent);
      
//       // Only include if we have meaningful content
//       if (cleanTitle && cleanTitle.length > 3) {
//         sections.push({
//           id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
//           section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
//           sectionNumber,
//           sectionTitle: cleanTitle,
//           markdownContent
//         });
//       }
//     }
    
//     console.log(`    Part ${partNumber}: Found ${sections.length} sections`);
    
//     // Sort sections by section number
//     return sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
//   }

//   /**
//    * Parse section content into structured format
//    */
//   private static parseSectionContent(content: string): ContentItem[] {
//     if (!content.trim()) {
//       return [];
//     }
    
//     const items: ContentItem[] = [];
//     const lines = content.split('\n').filter(line => {
//       const trimmed = line.trim();
//       return trimmed && 
//              !/^[A-Z]\d+$/.test(trimmed) && // Page numbers like A131
//              !/^\d+$/.test(trimmed) && // Standalone numbers
//              trimmed.length > 2; // Minimum meaningful length
//     });
    
//     let currentItem: ListItem | NumberedListItem | null = null;
    
//     for (const line of lines) {
//       const trimmedLine = line.trim();
      
//       if (this.isPageArtifact(trimmedLine)) {
//         continue;
//       }
      
//       // Check for lettered list items (a), (b), etc.
//       const letterMatch = trimmedLine.match(/^\(([a-z])\)\s*(.*)/i);
//       if (letterMatch) {
//         if (currentItem) {
//           items.push(currentItem);
//         }
//         currentItem = {
//           letter: letterMatch[1].toLowerCase(),
//           content: [this.cleanText(letterMatch[2].trim())]
//         };
//         continue;
//       }
      
//       // Check for numbered list items (1), (2), etc.
//       const numberMatch = trimmedLine.match(/^\((\d+)\)\s*(.*)/);
//       if (numberMatch) {
//         if (currentItem) {
//           items.push(currentItem);
//         }
//         currentItem = {
//           number: numberMatch[1],
//           content: [this.cleanText(numberMatch[2].trim())]
//         };
//         continue;
//       }
      
//       // Check for Roman numerals (i), (ii), etc.
//       const romanMatch = trimmedLine.match(/^\(([ivx]+)\)\s*(.*)/i);
//       if (romanMatch) {
//         if (currentItem) {
//           items.push(currentItem);
//         }
//         currentItem = {
//           number: romanMatch[1].toLowerCase(),
//           content: [this.cleanText(romanMatch[2].trim())]
//         };
//         continue;
//       }
      
//       // If we're in a list item and this line continues it
//       if (currentItem && trimmedLine && !trimmedLine.match(/^\([a-z0-9]\)/i)) {
//         currentItem.content.push(this.cleanText(trimmedLine));
//       } else {
//         // Finalize current list item
//         if (currentItem) {
//           items.push(currentItem);
//           currentItem = null;
//         }
        
//         // Add as regular text
//         if (trimmedLine && !this.isPageArtifact(trimmedLine)) {
//           items.push(this.cleanText(trimmedLine));
//         }
//       }
//     }
    
//     // Don't forget the last item
//     if (currentItem) {
//       items.push(currentItem);
//     }
    
//     // If no structured items found, return the entire content as paragraphs
//     if (items.length === 0 && content.trim()) {
//       const paragraphs = content.split(/\n\s*\n/).filter(p => {
//         const trimmed = p.trim();
//         return trimmed && !this.isPageArtifact(trimmed) && trimmed.length > 10;
//       });
      
//       if (paragraphs.length > 0) {
//         return paragraphs.map(p => this.cleanText(p));
//       }
      
//       return [this.cleanText(content)];
//     }
    
//     return items;
//   }

//   /**
//    * Check if a line is likely a page artifact
//    */
//   private static isPageArtifact(line: string): boolean {
//     const trimmed = line.trim();
//     return /^[A-Z]\d+$/.test(trimmed) || // Page numbers like A131
//            /^\d+$/.test(trimmed) || // Standalone numbers
//            trimmed.length < 3 || // Too short to be meaningful
//            /^[\.\-\s]+$/.test(trimmed); // Only dots, dashes, or spaces
//   }

//   private static cleanSectionTitle(title: string): string {
//     return title
//       .replace(/[—:\-]+$/, '')
//       .replace(/^[—:\-]+/, '')
//       .trim();
//   }

//   private static cleanText(text: string): string {
//     return text
//       .replace(/\s+/g, ' ')
//       .replace(/[—:\-]\s*$/, '')
//       .replace(/^\s*[—:\-]\s*/, '')
//       .trim();
//   }

//   private static extractSchedules(text: string): Schedule[] {
//     const schedules: Schedule[] = [];
//     const scheduleNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    
//     scheduleNames.forEach((name, index) => {
//       const scheduleNumber = index + 1;
//       schedules.push({
//         id: `sch${scheduleNumber}`,
//         schedule: `sch${scheduleNumber}`,
//         scheduleNumber,
//         scheduleTitle: `${name} Schedule`,
//         markdownContent: [this.getScheduleDescription(name)]
//       });
//     });
    
//     return schedules;
//   }

//   private static getScheduleDescription(name: string): string {
//     const descriptions: { [key: string]: string } = {
//       'First': 'Rights of pre-emption of petroleum and petroleum products in the event of national emergency.',
//       'Second': 'Provisions relating to royalties, rents and other payments to Government.',
//       'Third': 'Environmental management and remediation guidelines.',
//       'Fourth': 'Host communities development trust provisions.',
//       'Fifth': 'Fiscal framework and tax provisions.',
//       'Sixth': 'Administrative procedures and regulations.',
//       'Seventh': 'Transitional and savings provisions.',
//       'Eighth': 'Miscellaneous provisions and amendments.',
//       'Ninth': 'Supplementary provisions.',
//       'Tenth': 'Final provisions.'
//     };
    
//     return descriptions[name] || `Provisions and regulations for the ${name} Schedule.`;
//   }

//   private static extractMetadata(text: string): DocumentMetadata {
//     return {
//       source: 'Federal Republic of Nigeria Official Gazette',
//       publisher: 'Federal Government Printer, Lagos, Nigeria',
//       pageRange: 'A121–A370',
//       format: 'markdown',
//       encoding: 'UTF-8'
//     };
//   }

//   // Generate table of contents from structured document
//   static generateTableOfContents(structuredDoc: StructuredDocument): any {
//     return {
//       id: structuredDoc.id,
//       title: structuredDoc.title,
//       actNumber: structuredDoc.actNumber,
//       year: structuredDoc.year,
//       chapters: structuredDoc.chapters.map(chapter => ({
//         id: chapter.id,
//         chapterNumber: chapter.chapterNumber,
//         chapterTitle: chapter.chapterTitle,
//         parts: chapter.parts.map(part => ({
//           id: part.id,
//           partNumber: part.partNumber,
//           partTitle: part.partTitle,
//           sections: part.sections.map(section => ({
//             id: section.id,
//             sectionNumber: section.sectionNumber,
//             sectionTitle: section.sectionTitle
//           }))
//         }))
//       })),
//       schedules: structuredDoc.schedules.map(schedule => ({
//         id: schedule.id,
//         scheduleNumber: schedule.scheduleNumber,
//         scheduleTitle: schedule.scheduleTitle
//       }))
//     };
//   }

//   /**
//    * Utility method to get a specific section by ID
//    */
//   static getSectionById(structuredDoc: StructuredDocument, sectionId: string): Section | null {
//     for (const chapter of structuredDoc.chapters) {
//       for (const part of chapter.parts) {
//         for (const section of part.sections) {
//           if (section.id === sectionId) {
//             return section;
//           }
//         }
//       }
//     }
//     return null;
//   }

//   /**
//    * Utility method to search sections by title or content
//    */
//   static searchSections(structuredDoc: StructuredDocument, query: string): Section[] {
//     const results: Section[] = [];
//     const lowerQuery = query.toLowerCase();
    
//     for (const chapter of structuredDoc.chapters) {
//       for (const part of chapter.parts) {
//         for (const section of part.sections) {
//           // Search in section title
//           if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
//             results.push(section);
//             continue;
//           }
          
//           // Search in section content
//           const contentText = this.flattenContent(section.markdownContent).toLowerCase();
//           if (contentText.includes(lowerQuery)) {
//             results.push(section);
//           }
//         }
//       }
//     }
    
//     return results;
//   }

//   /**
//    * Flatten content for searching
//    */
//   private static flattenContent(content: ContentItem[]): string {
//     return content.map(item => {
//       if (typeof item === 'string') {
//         return item;
//       } else if ('letter' in item) {
//         return `(${item.letter}) ${this.flattenContent(item.content)}`;
//       } else if ('number' in item) {
//         return `(${item.number}) ${this.flattenContent(item.content)}`;
//       }
//       return '';
//     }).join(' ');
//   }
// }
