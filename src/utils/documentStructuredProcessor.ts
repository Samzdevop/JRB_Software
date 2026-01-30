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
    
    // console.log('=== PROCESSING DOCUMENT ===');
    // console.log('Text length:', rawText.length);
    
    // Find where the actual content starts (after table of contents)
    const contentStartIndex = this.findContentStartIndex(rawText);
    
    if (contentStartIndex === -1) {
      // console.log('Could not find content start, using full text');
      return this.processFullDocument(rawText, documentId, originalFileName);
    }
    
    // Extract only the content part (from CHAPTER 1 onwards)
    const contentText = rawText.substring(contentStartIndex);
    // console.log('Content text starts at index:', contentStartIndex);
    // console.log('Content text length:', contentText.length);
    
    return this.processFullDocument(contentText, documentId, originalFileName);
  }

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
    
    // console.log(`Found ${chapterMatches.length} chapters in text`);
    
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
      
      // console.log(`Processing Chapter ${currentChapter.number}: ${currentChapter.title}`);
      
      let cleanChapterContent = chapterContent;
      
      // For Chapter 3, ensure we don't include Chapter 4 content
      if (currentChapter.number === 3) {
        const chapter4Start = chapterContent.indexOf('CHAPTER 4');
        if (chapter4Start !== -1) {
          cleanChapterContent = chapterContent.substring(0, chapter4Start);
          // console.log(`  Truncated Chapter 3 at Chapter 4 start`);
        }
      }
      
      // For Chapter 4, ensure we don't include Chapter 5 content
      if (currentChapter.number === 4) {
        const chapter5Start = chapterContent.indexOf('CHAPTER 5');
        if (chapter5Start !== -1) {
          cleanChapterContent = chapterContent.substring(0, chapter5Start);
          // console.log(`  Truncated Chapter 4 at Chapter 5 start`);
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
      // console.log('Adding missing Chapter 4...');
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
        
        // console.log(`Added Chapter 4: ${chapter4Title}`);
      }
    }
    
    // Add Chapter 5 if missing
    if (!chapterNumbers.includes(5)) {
      // console.log('Adding missing Chapter 5...');
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
        
        // console.log(`Added Chapter 5: ${chapter5Title}`);
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
    
    // console.log(`  Chapter ${chapterNumber}: Found ${partMatches.length} parts`);
    
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
   * Extract sections from content - COMPLETE SOLUTION FOR ALL SECTIONS
   */
  private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
    const sections: Section[] = [];
    
    if (!content.trim()) {
      return sections;
    }
    
    // Find ALL main sections (numbers without brackets like 1., 2., 3., 66., etc.)
    // FIXED: Changed regex to only match section numbers that are reasonable (1-999)
    const mainSectionRegex = /(?:^|\n)(\d{1,3})\.\s*(?:[—\-]?\s*\(?\d+\)?[—\-]?\s*)?([^\n]*)/g;
    
    const allMatches: Array<{
      type: 'main-section' | 'subsection',
      number: number,
      title: string,
      index: number,
      rawText: string
    }> = [];
    
    // First pass: collect all matches
    let match;
    while ((match = mainSectionRegex.exec(content)) !== null) {
      const sectionNumber = parseInt(match[1]);
      const sectionTitle = match[2].trim();
      
      // Only accept reasonable section numbers (1-999 for this act)
      // The year 2021 might appear in the text, but shouldn't be a section number
      if (sectionNumber < 1 || sectionNumber > 999) {
        continue;
      }
      
      // Skip very small numbers that might be list items
      if (sectionNumber < 10 && sectionTitle.length < 3) {
        continue;
      }
      
      // Additional check: if the title contains "The regulations under subsection",
      // it's likely continuation text, not a new section
      if (sectionTitle.toLowerCase().includes('the regulations under subsection')) {
        continue;
      }
      
      allMatches.push({
        type: 'main-section',
        number: sectionNumber,
        title: sectionTitle,
        index: match.index,
        rawText: match[0]
      });
    }
    
    // Process each main section
    for (let i = 0; i < allMatches.length; i++) {
      const currentMatch = allMatches[i];
      const nextMatchIndex = i + 1 < allMatches.length ? allMatches[i + 1].index : content.length;
      
      // Extract this section's full content
      const sectionStart = currentMatch.index + currentMatch.rawText.length;
      const sectionContent = content.substring(sectionStart, nextMatchIndex);
      
      // Process this section to get main section and subsections
      const sectionResults = this.processIndividualSection(
        currentMatch.number,
        currentMatch.title,
        sectionContent,
        chapterNumber,
        partNumber
      );
      
      // Add all results (main section + subsections) to sections array
      sections.push(...sectionResults);
    }
    
    // Sort sections properly
    return sections.sort((a, b) => {
      // Extract main section number and subsection number
      const aMatch = a.id.match(/ch\d+-pt\d+-s(\d+)(?:-us(\d+))?/);
      const bMatch = b.id.match(/ch\d+-pt\d+-s(\d+)(?:-us(\d+))?/);
      
      if (!aMatch || !bMatch) return 0;
      
      const aMain = parseInt(aMatch[1]);
      const bMain = parseInt(bMatch[1]);
      const aSub = aMatch[2] ? parseInt(aMatch[2]) : 0;
      const bSub = bMatch[2] ? parseInt(bMatch[2]) : 0;
      
      // First sort by main section number
      if (aMain !== bMain) {
        return aMain - bMain;
      }
      
      // Then by subsection number (0 for main sections, so they come first)
      return aSub - bSub;
    });
  }

  /**
   * Process an individual section to extract main section and subsections
   */
  private static processIndividualSection(
    mainSectionNumber: number,
    mainSectionTitle: string,
    sectionContent: string,
    chapterNumber: number,
    partNumber: number
  ): Section[] {
    const sections: Section[] = [];
    
    // Clean the main section title
    const cleanedMainTitle = this.cleanText(mainSectionTitle);
    
    // Create the main section first
    const mainSection: Section = {
      id: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}`,
      section: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}`,
      sectionNumber: mainSectionNumber,
      sectionTitle: cleanedMainTitle,
      markdownContent: []
    };
    
    // Parse the section content to find subsections
    const parsedContent = this.parseSectionContentWithSubsections(sectionContent);
    
    // Add main section content
    if (parsedContent.mainContent) {
      mainSection.markdownContent = [parsedContent.mainContent];
    }
    
    sections.push(mainSection);
    
    // Add subsections if any
    for (const sub of parsedContent.subsections) {
      const subsection: Section = {
        id: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}-us${sub.number}`,
        section: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}-us${sub.number}`,
        sectionNumber: mainSectionNumber,
        sectionTitle: `(${sub.number})${sub.title ? ' ' + sub.title : ''}`,
        markdownContent: sub.content ? [sub.content] : []
      };
      sections.push(subsection);
    }
    
    return sections;
  }

  /**
   * Parse section content to identify main content and subsections
   */
  private static parseSectionContentWithSubsections(content: string): {
    mainContent: string;
    subsections: Array<{number: number, title: string, content: string}>;
  } {
    const result = {
      mainContent: '',
      subsections: [] as Array<{number: number, title: string, content: string}>
    };
    
    if (!content.trim()) {
      return result;
    }
    
    // Find all potential subsection markers
    const subsectionPattern = /(?:^|\n)(?:\((\d+)\))(?:[—\-]?\s*)?([^\n]*)/g;
    const matches: Array<{number: number, title: string, index: number, rawText: string}> = [];
    
    let match;
    while ((match = subsectionPattern.exec(content)) !== null) {
      const number = parseInt(match[1]);
      // Only accept reasonable subsection numbers (1-20)
      if (number >= 1 && number <= 20) {
        matches.push({
          number: number,
          title: match[2].trim(),
          index: match.index,
          rawText: match[0]
        });
      }
    }
    
    if (matches.length === 0) {
      // No subsections found
      result.mainContent = this.cleanSectionContent(content, true);
      return result;
    }
    
    // Extract content before first subsection
    const firstSubsectionIndex = matches[0].index;
    const contentBeforeFirstSub = content.substring(0, firstSubsectionIndex).trim();
    
    if (contentBeforeFirstSub) {
      result.mainContent = this.cleanSectionContent(contentBeforeFirstSub, true);
    }
    
    // Process each subsection
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatchIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
      
      // Extract subsection content
      const subStart = currentMatch.index + currentMatch.rawText.length;
      const subContent = content.substring(subStart, nextMatchIndex).trim();
      
      // Clean the content
      const cleanedContent = this.cleanSectionContent(subContent, true);
      
      // Clean the title
      const cleanedTitle = this.cleanText(currentMatch.title);
      
      result.subsections.push({
        number: currentMatch.number,
        title: cleanedTitle,
        content: cleanedContent
      });
    }
    
    return result;
  }

  /**
   * Clean section content
   */
  private static cleanSectionContent(content: string, extractAlphabetItems: boolean): string {
    if (!content.trim()) return '';
    
    let cleaned = content;
    
    // Remove page artifacts
    cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\d{1,3}\s*$/gm, '');
    
    // Handle page continuation
    const lines = cleaned.split('\n');
    const processedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      if (!line) {
        if (i > 0 && i < lines.length - 1 && lines[i-1].trim() && lines[i+1].trim()) {
          processedLines.push('');
        }
        continue;
      }
      
      // Skip page artifacts
      if (this.isPageArtifact(line)) {
        continue;
      }
      
      // Handle page continuation
      if (i > 0 && this.isContinuationLine(line, lines[i-1])) {
        if (processedLines.length > 0) {
          const lastLine = processedLines[processedLines.length - 1];
          if (lastLine.endsWith('-')) {
            processedLines[processedLines.length - 1] = lastLine.slice(0, -1) + line;
          } else {
            processedLines[processedLines.length - 1] = lastLine + ' ' + line;
          }
          continue;
        }
      }
      
      processedLines.push(line);
    }
    
    cleaned = processedLines.join('\n');
    
    // Format alphabet items consistently if needed
    if (extractAlphabetItems) {
      cleaned = cleaned.replace(/\(([a-z])\)/g, '($1)');
      cleaned = cleaned.replace(/([a-z])\)/g, '($1)');
      cleaned = cleaned.replace(/\(([a-z])\./g, '($1)');
      cleaned = cleaned.replace(/([a-z])\./g, '($1)');
    }
    
    // Clean formatting
    cleaned = cleaned.replace(/\s+\)/g, ')');
    cleaned = cleaned.replace(/\(\s+/g, '(');
    cleaned = cleaned.replace(/\s+;/g, ' ;');
    cleaned = cleaned.replace(/;\s+/g, ' ; ');
    cleaned = cleaned.replace(/\s+:/g, ' :');
    cleaned = cleaned.replace(/:\s+/g, ' : ');
    cleaned = cleaned.replace(/\s*,\s*/g, ', ');
    cleaned = cleaned.replace(/\s*-\s*/g, '-');
    cleaned = cleaned.replace(/\s*—\s*/g, '—');
    cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  }

  /**
   * Check if line is continuation from previous page
   */
  private static isContinuationLine(line: string, prevLine: string): boolean {
    const prevTrimmed = prevLine.trim();
    const lineTrimmed = line.trim();
    
    const prevEndsIncomplete = prevTrimmed.endsWith(';') || 
                              prevTrimmed.endsWith(',') || 
                              prevTrimmed.endsWith('-') ||
                              prevTrimmed.endsWith('—');
    
    const looksLikeSection = lineTrimmed.match(/^\d+\.\s/) || lineTrimmed.match(/^\(\d+\)/);
    
    if (prevEndsIncomplete && looksLikeSection) {
      const sectionMatch = lineTrimmed.match(/^(\d+)\.\s/) || lineTrimmed.match(/^\((\d+)\)/);
      if (sectionMatch) {
        const sectionNum = parseInt(sectionMatch[1]);
        return sectionNum < 10;
      }
    }
    
    return false;
  }

  /**
   * Clean text (for titles)
   */
  private static cleanText(text: string): string {
    if (!text) return '';
    
    let cleaned = text;
    
    cleaned = cleaned.replace(/^[—:\-\.\s]+/, '');
    cleaned = cleaned.replace(/[—:\-\.\s]+$/, '');
    
    if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    return cleaned.trim();
  }

  /**
   * Check if line is a page artifact
   */
  private static isPageArtifact(line: string): boolean {
    const trimmed = line.trim();
    
    if (/^[A-Z]\d{2,4}$/.test(trimmed)) return true;
    if (/^\d{1,3}$/.test(trimmed)) return true;
    if (trimmed.length < 3 && !trimmed.match(/[a-z0-9]/i)) return true;
    if (/^[\.\-\s]+$/.test(trimmed)) return true;
    
    if (/^[A-Z\s]{2,30}$/.test(trimmed)) {
      const commonHeaders = [
        'PETROLEUM INDUSTRY ACT', 'ACT NO', 'CHAPTER', 'PART', 'SCHEDULE',
        'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH',
        'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH'
      ];
      
      if (commonHeaders.some(header => trimmed.includes(header))) {
        return true;
      }
    }
    
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



























































































































// // main codebase
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
    
//     // console.log('=== PROCESSING DOCUMENT ===');
//     // console.log('Text length:', rawText.length);
    
//     // Find where the actual content starts (after table of contents)
//     const contentStartIndex = this.findContentStartIndex(rawText);
    
//     if (contentStartIndex === -1) {
//       // console.log('Could not find content start, using full text');
//       return this.processFullDocument(rawText, documentId, originalFileName);
//     }
    
//     // Extract only the content part (from CHAPTER 1 onwards)
//     const contentText = rawText.substring(contentStartIndex);
//     // console.log('Content text starts at index:', contentStartIndex);
//     // console.log('Content text length:', contentText.length);
    
//     return this.processFullDocument(contentText, documentId, originalFileName);
//   }

//   private static findContentStartIndex(text: string): number {
//     // Look for patterns that indicate the start of actual content
//     const patterns = [
//       /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS\s+PART\s+I[—\-]\s*OBJECTIVES\s+AND\s+APPLICATION\s*\n\s*\d+\.\s+/i,
//       /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS[^\n]*\n\s*\d+\.\s+The\s+property\s+and\s+ownership/i,
//       /CHAPTER\s+1[—\-][\s\S]*?1\.\s+The\s+property\s+and\s+ownership/i,
//       /PETROLEUM\s+INDUSTRY\s+ACT,\s*2021[\s\S]*?CHAPTER\s+1[—\-]/i,
//     ];
    
//     for (const pattern of patterns) {
//       const match = text.match(pattern);
//       if (match) {
//         return match.index!;
//       }
//     }
    
//     const section1Index = text.search(/\n\s*1\.\s+The\s+property\s+and\s+ownership/i);
//     if (section1Index !== -1) {
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
    
//     // First, find all chapters
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
    
//     // console.log(`Found ${chapterMatches.length} chapters in text`);
    
//     // Process each chapter found
//     for (let i = 0; i < chapterMatches.length; i++) {
//       const currentChapter = chapterMatches[i];
      
//       let nextChapterIndex;
//       if (i + 1 < chapterMatches.length) {
//         nextChapterIndex = chapterMatches[i + 1].index;
//       } else {
//         const scheduleStart = text.indexOf('FIRST SCHEDULE', currentChapter.index);
//         nextChapterIndex = scheduleStart !== -1 ? scheduleStart : text.length;
//       }
      
//       const chapterContent = text.substring(currentChapter.index, nextChapterIndex);
      
//       // console.log(`Processing Chapter ${currentChapter.number}: ${currentChapter.title}`);
      
//       let cleanChapterContent = chapterContent;
      
//       // For Chapter 3, ensure we don't include Chapter 4 content
//       if (currentChapter.number === 3) {
//         const chapter4Start = chapterContent.indexOf('CHAPTER 4');
//         if (chapter4Start !== -1) {
//           cleanChapterContent = chapterContent.substring(0, chapter4Start);
//           // console.log(`  Truncated Chapter 3 at Chapter 4 start`);
//         }
//       }
      
//       // For Chapter 4, ensure we don't include Chapter 5 content
//       if (currentChapter.number === 4) {
//         const chapter5Start = chapterContent.indexOf('CHAPTER 5');
//         if (chapter5Start !== -1) {
//           cleanChapterContent = chapterContent.substring(0, chapter5Start);
//           // console.log(`  Truncated Chapter 4 at Chapter 5 start`);
//         }
//       }
      
//       const parts = this.extractPartsForChapter(cleanChapterContent, currentChapter.number);
      
//       chapters.push({
//         id: `ch${currentChapter.number}`,
//         chapter: `ch${currentChapter.number}`,
//         chapterNumber: currentChapter.number,
//         chapterTitle: currentChapter.title,
//         parts
//       });
//     }
    
//     // Check for missing chapters and add them
//     const chapterNumbers = chapters.map(ch => ch.chapterNumber);
    
//     // Add Chapter 4 if missing
//     if (!chapterNumbers.includes(4)) {
//       // console.log('Adding missing Chapter 4...');
//       const chapter4Index = text.indexOf('CHAPTER 4');
//       if (chapter4Index !== -1) {
//         let chapter4EndIndex = text.indexOf('CHAPTER 5', chapter4Index);
//         if (chapter4EndIndex === -1) {
//           chapter4EndIndex = text.indexOf('FIRST SCHEDULE', chapter4Index);
//           if (chapter4EndIndex === -1) {
//             chapter4EndIndex = text.length;
//           }
//         }
        
//         const chapter4Content = text.substring(chapter4Index, chapter4EndIndex);
//         const parts = this.extractPartsForChapter(chapter4Content, 4);
        
//         const titleMatch = chapter4Content.match(/CHAPTER\s+4[—\-]\s*([^\n]+)/i);
//         const chapter4Title = titleMatch ? titleMatch[1].toUpperCase().trim() : 'PETROLEUM INDUSTRY FISCAL FRAMEWORK';
        
//         chapters.push({
//           id: 'ch4',
//           chapter: 'ch4',
//           chapterNumber: 4,
//           chapterTitle: chapter4Title,
//           parts
//         });
        
//         // console.log(`Added Chapter 4: ${chapter4Title}`);
//       }
//     }
    
//     // Add Chapter 5 if missing
//     if (!chapterNumbers.includes(5)) {
//       // console.log('Adding missing Chapter 5...');
//       const chapter5Index = text.indexOf('CHAPTER 5');
//       if (chapter5Index !== -1) {
//         let chapter5EndIndex = text.indexOf('FIRST SCHEDULE', chapter5Index);
//         if (chapter5EndIndex === -1) {
//           chapter5EndIndex = text.length;
//         }
        
//         const chapter5Content = text.substring(chapter5Index, chapter5EndIndex);
//         const parts = this.extractPartsForChapter(chapter5Content, 5);
        
//         const titleMatch = chapter5Content.match(/CHAPTER\s+5[—\-]\s*([^\n]+)/i);
//         const chapter5Title = titleMatch ? titleMatch[1].toUpperCase().trim() : 'MISCELLANEOUS PROVISIONS';
        
//         chapters.push({
//           id: 'ch5',
//           chapter: 'ch5',
//           chapterNumber: 5,
//           chapterTitle: chapter5Title,
//           parts
//         });
        
//         // console.log(`Added Chapter 5: ${chapter5Title}`);
//       }
//     }
    
//     return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
//   }

//   /**
//    * Extract parts within a chapter
//    */
//   private static extractPartsForChapter(chapterText: string, chapterNumber: number): Part[] {
//     const parts: Part[] = [];
    
//     let cleanChapterText = chapterText;
    
//     // Remove any next chapter headers
//     if (chapterNumber < 5) {
//       const nextChapterNum = chapterNumber + 1;
//       const nextChapterPattern = new RegExp(`CHAPTER\\s+${nextChapterNum}`, 'i');
//       const nextChapterMatch = cleanChapterText.match(nextChapterPattern);
//       if (nextChapterMatch) {
//         cleanChapterText = cleanChapterText.substring(0, nextChapterMatch.index);
//       }
//     }
    
//     // Remove schedule content
//     const scheduleStart = cleanChapterText.indexOf('FIRST SCHEDULE');
//     if (scheduleStart !== -1) {
//       cleanChapterText = cleanChapterText.substring(0, scheduleStart);
//     }
    
//     if (!cleanChapterText.trim()) {
//       return parts;
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
    
//     // console.log(`  Chapter ${chapterNumber}: Found ${partMatches.length} parts`);
    
//     if (partMatches.length > 0) {
//       for (let i = 0; i < partMatches.length; i++) {
//         const currentPart = partMatches[i];
//         const nextPartIndex = i + 1 < partMatches.length ? partMatches[i + 1].index : cleanChapterText.length;
        
//         const partContent = cleanChapterText.substring(currentPart.index, nextPartIndex);
        
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
//    * Extract sections from content - FIXED VERSION
//    */
//   private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
//     const sections: Section[] = [];
    
//     if (!content.trim()) {
//       return sections;
//     }
    
//     // For Chapter 5, we need to skip definition sections (low numbers)
//     // and only get actual Chapter 5 sections (starting around 307)
//     let contentToParse = content;
    
//     // Find all section headers
//     const sectionHeaderRegex = /(\d+[A-Z]?)\.?\s*\.?\s*(?:—\s*)?([^\n]+)/g;
//     const headers: Array<{number: number, title: string, index: number, rawNumber: string}> = [];
    
//     let match;
//     while ((match = sectionHeaderRegex.exec(contentToParse)) !== null) {
//       const rawNumber = match[1];
//       let sectionNumber = parseInt(rawNumber.replace(/\.$/, ''));
//       const sectionTitle = match[2].trim();
      
//       // Skip if it's not a valid section
//       if (sectionNumber <= 0 || !sectionTitle || sectionTitle.length < 2) {
//         continue;
//       }
      
//       // Special handling for Chapter 5 - skip definition sections
//       if (chapterNumber === 5) {
//         // Chapter 5 sections start at 307, skip lower numbers (definitions)
//         if (sectionNumber < 300) {
//           // console.log(`  Skipping section ${sectionNumber} in Chapter 5 - likely definition`);
//           continue;
//         }
//       }
      
//       // Special handling for Chapter 4 - sections start at 258
//       if (chapterNumber === 4 && sectionNumber < 258) {
//         // console.log(`  Skipping section ${sectionNumber} in Chapter 4 - likely Chapter 3 content`);
//         continue;
//       }
      
//       // Special handling for Chapter 3 - sections should be around 234
//       if (chapterNumber === 3 && sectionNumber > 300) {
//         // console.log(`  Skipping section ${sectionNumber} in Chapter 3 - likely Chapter 4 content`);
//         continue;
//       }
      
//       headers.push({
//         number: sectionNumber,
//         title: sectionTitle,
//         index: match.index,
//         rawNumber: rawNumber
//       });
//     }
    
//     console.log(`  Chapter ${chapterNumber}, Part ${partNumber}: Found ${headers.length} sections`);
    
//     // Process each section
//     for (let i = 0; i < headers.length; i++) {
//       const currentHeader = headers[i];
//       const nextHeaderIndex = i + 1 < headers.length ? headers[i + 1].index : contentToParse.length;
      
//       const headerText = `${currentHeader.rawNumber}. ${currentHeader.title}`;
//       const sectionStart = currentHeader.index + headerText.length;
//       let sectionContent = contentToParse.substring(sectionStart, nextHeaderIndex).trim();
      
//       // Clean the section content
//       const cleanedContent = this.cleanSectionContent(sectionContent);
      
//       sections.push({
//         id: `ch${chapterNumber}-pt${partNumber}-s${currentHeader.number}`,
//         section: `ch${chapterNumber}-pt${partNumber}-s${currentHeader.number}`,
//         sectionNumber: currentHeader.number,
//         sectionTitle: this.cleanSectionTitle(currentHeader.title),
//         markdownContent: cleanedContent ? [cleanedContent] : []
//       });
//     }
    
//     return sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
//   }

//   /**
//    * Clean section content
//    */
//   private static cleanSectionContent(content: string): string {
//     if (!content.trim()) return '';
    
//     let cleaned = content;
    
//     // Remove page artifacts
//     cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    
//     // Split into lines and filter
//     const lines = cleaned.split('\n');
//     const filteredLines: string[] = [];
    
//     for (let i = 0; i < lines.length; i++) {
//       const line = lines[i].trim();
      
//       if (!line) {
//         if (i > 0 && i < lines.length - 1 && 
//             lines[i-1].trim() && lines[i+1].trim()) {
//           filteredLines.push('');
//         }
//         continue;
//       }
      
//       if (this.isPageArtifact(line)) {
//         continue;
//       }
      
//       filteredLines.push(line);
//     }
    
//     cleaned = filteredLines.join('\n');
    
//     // Normalize whitespace
//     cleaned = cleaned.replace(/[ \t]+/g, ' ');
//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
//     cleaned = cleaned.replace(/\s+\)/g, ')');
//     cleaned = cleaned.replace(/\(\s+/g, '(');
    
//     return cleaned.trim();
//   }

//   /**
//    * Page artifact detection
//    */
//   private static isPageArtifact(line: string): boolean {
//     const trimmed = line.trim();
    
//     if (/^[A-Z]\d+$/.test(trimmed)) return true;
//     if (/^\d+$/.test(trimmed)) return true;
//     if (trimmed.length < 3 && !trimmed.match(/[a-z]/i)) return true;
//     if (/^[\.\-\s]+$/.test(trimmed)) return true;
//     if (/^[A-Z\s]+$/.test(trimmed) && trimmed.length < 20 && !trimmed.includes('(')) return true;
    
//     return false;
//   }

//   /**
//    * Extract schedules from text
//    */
//   private static extractSchedulesFromText(text: string): Schedule[] {
//     const schedules: Schedule[] = [];
    
//     const scheduleStartIndex = text.indexOf('FIRST SCHEDULE');
//     if (scheduleStartIndex === -1) {
//       return this.getPlaceholderSchedules();
//     }
    
//     const scheduleText = text.substring(scheduleStartIndex);
    
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
//       }
//     }
    
//     if (schedules.length === 0) {
//       return this.getPlaceholderSchedules();
//     }
    
//     return schedules;
//   }

//   /**
//    * Clean schedule content
//    */
//   private static cleanScheduleContent(content: string): string {
//     if (!content.trim()) return 'No content available.';
    
//     let cleaned = content;
    
//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
//     cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^[A-Z\s]+SCHEDULE[^a-z]*/i, '');
    
//     return cleaned.trim();
//   }

//   /**
//    * Get placeholder schedules
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
//    * Clean section title
//    */
//   private static cleanSectionTitle(title: string): string {
//     return title
//       .replace(/[—:\-]+$/, '')
//       .replace(/^[—:\-]+/, '')
//       .trim();
//   }

//   /**
//    * Helper methods
//    */
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

//   /**
//    * Generate table of contents
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
//    * Utility methods
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

//   static searchSections(structuredDoc: StructuredDocument, query: string): Section[] {
//     const results: Section[] = [];
//     const lowerQuery = query.toLowerCase();
    
//     for (const chapter of structuredDoc.chapters) {
//       for (const part of chapter.parts) {
//         for (const section of part.sections) {
//           if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
//             results.push(section);
//             continue;
//           }
          
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