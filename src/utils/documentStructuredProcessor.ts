import { ProcessedContent, StructuredSection } from "./textProcessor";

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

export interface Chapter {
  id: string;
  chapter: string;
  chapterNumber: number;
  chapterTitle: string;
  parts: Part[];
}

export interface Part {
  id: string;
  part: string;
  partNumber: number;
  partTitle: string;
  sections: Section[];
}

export interface Section {
  id: string;
  section: string;
  sectionNumber: number;
  sectionTitle: string;
  markdownContent: ContentItem[];
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

export interface Schedule {
  id: string;
  schedule: string;
  scheduleNumber: number;
  scheduleTitle: string;
  markdownContent: string[];
}

export interface DocumentMetadata {
  source: string;
  publisher: string;
  pageRange: string;
  format: string;
  encoding: string;
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
    
    return {
      id: documentId,
      title: this.extractTitle(rawText, originalFileName),
      actNumber: this.extractActNumber(rawText),
      year: this.extractYear(rawText),
      commencementDate: this.extractCommencementDate(rawText),
      description: this.extractDescription(rawText),
      chapters: this.extractChaptersWithCorrectStructure(rawText),
      schedules: this.extractSchedules(rawText),
      metadata: this.extractMetadata(rawText)
    };
  }

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

  private static extractChaptersWithCorrectStructure(text: string): Chapter[] {
    const chapters: Chapter[] = [];
    const seenChapters = new Set<number>();
    
    // Find all chapter markers in the text
    const chapterRegex = /CHAPTER\s+(\d+)[—\-]\s*([^\n]+)/gi;
    let chapterMatch;
    const chapterMatches: Array<{number: number, title: string, index: number}> = [];
    
    // Collect all chapter matches with their positions
    while ((chapterMatch = chapterRegex.exec(text)) !== null) {
      const chapterNumber = parseInt(chapterMatch[1]);
      const chapterTitle = chapterMatch[2].trim().toUpperCase();
      
      if (!seenChapters.has(chapterNumber)) {
        seenChapters.add(chapterNumber);
        chapterMatches.push({
          number: chapterNumber,
          title: chapterTitle,
          index: chapterMatch.index
        });
      }
    }
    
    console.log(`Found ${chapterMatches.length} chapters`);
    
    // Process each chapter
    for (let i = 0; i < chapterMatches.length; i++) {
      const currentChapter = chapterMatches[i];
      const nextChapterIndex = i + 1 < chapterMatches.length ? chapterMatches[i + 1].index : text.length;
      
      // Extract chapter content
      const chapterContent = text.substring(currentChapter.index, nextChapterIndex);
      
      const parts = this.extractPartsForChapter(chapterContent, currentChapter.number);
      
      chapters.push({
        id: `ch${currentChapter.number}`,
        chapter: `ch${currentChapter.number}`,
        chapterNumber: currentChapter.number,
        chapterTitle: currentChapter.title,
        parts
      });
    }
    
    return chapters;
  }

  private static extractPartsForChapter(chapterText: string, chapterNumber: number): Part[] {
    const parts: Part[] = [];
    const seenParts = new Set<string>();
    
    // Find all part markers in this chapter
    const partRegex = /PART\s+([IVXLCDM]+)[—\-]\s*([^\n]+)/gi;
    let partMatch;
    const partMatches: Array<{number: number, title: string, index: number}> = [];
    let partCounter = 1;
    
    while ((partMatch = partRegex.exec(chapterText)) !== null) {
      const partTitle = partMatch[2].trim().toUpperCase();
      const partKey = `${chapterNumber}-${partTitle}`;
      
      if (!seenParts.has(partKey)) {
        seenParts.add(partKey);
        partMatches.push({
          number: partCounter,
          title: partTitle,
          index: partMatch.index
        });
        partCounter++;
      }
    }
    
    console.log(`  Chapter ${chapterNumber}: Found ${partMatches.length} parts`);
    
    // Process each part in this chapter
    if (partMatches.length > 0) {
      for (let i = 0; i < partMatches.length; i++) {
        const currentPart = partMatches[i];
        const nextPartIndex = i + 1 < partMatches.length ? partMatches[i + 1].index : chapterText.length;
        
        // Extract part content
        const partContent = chapterText.substring(currentPart.index, nextPartIndex);
        
        const sections = this.extractSectionsFromContent(partContent, chapterNumber, currentPart.number);
        
        parts.push({
          id: `ch${chapterNumber}-pt${currentPart.number}`,
          part: `ch${chapterNumber}-pt${currentPart.number}`,
          partNumber: currentPart.number,
          partTitle: currentPart.title,
          sections
        });
      }
    } else {
      // If no parts found, treat the entire chapter as one part with sections
      const sections = this.extractSectionsFromContent(chapterText, chapterNumber, 1);
      if (sections.length > 0) {
        parts.push({
          id: `ch${chapterNumber}-pt1`,
          part: `ch${chapterNumber}-pt1`,
          partNumber: 1,
          partTitle: "PROVISIONS",
          sections
        });
      }
    }
    
    return parts;
  }

  private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
    const sections: Section[] = [];
    const seenSections = new Set<number>();
    
    // Improved section extraction that handles the actual document format
    const sectionRegex = /^(\d+)\.\s*—?\s*([^\n]+)([\s\S]*?)(?=^\d+\.\s*—|^CHAPTER\s+|^PART\s+|^SCHEDULE\s+|$)/gim;
    let match;
    
    while ((match = sectionRegex.exec(content)) !== null) {
      const sectionNumber = parseInt(match[1]);
      const sectionTitle = match[2].trim();
      let sectionContent = match[3] ? match[3].trim() : '';
      
      // Skip if we've already seen this section number
      if (seenSections.has(sectionNumber)) continue;
      seenSections.add(sectionNumber);
      
      // Clean up section title
      const cleanTitle = this.cleanSectionTitle(sectionTitle);
      
      // Parse the content into structured format
      const markdownContent = this.parseSectionContent(sectionContent);
      
      // Only include if we have meaningful content
      if (cleanTitle && cleanTitle.length > 3) {
        sections.push({
          id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
          section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
          sectionNumber,
          sectionTitle: cleanTitle,
          markdownContent
        });
      }
    }
    
    console.log(`    Part ${partNumber}: Found ${sections.length} sections`);
    
    // Sort sections by section number
    return sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
  }

  /**
   * Parse section content into structured format
   */
  private static parseSectionContent(content: string): ContentItem[] {
    if (!content.trim()) {
      return [];
    }
    
    const items: ContentItem[] = [];
    const lines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && 
             !/^[A-Z]\d+$/.test(trimmed) && // Page numbers like A131
             !/^\d+$/.test(trimmed) && // Standalone numbers
             trimmed.length > 2; // Minimum meaningful length
    });
    
    let currentItem: ListItem | NumberedListItem | null = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (this.isPageArtifact(trimmedLine)) {
        continue;
      }
      
      // Check for lettered list items (a), (b), etc.
      const letterMatch = trimmedLine.match(/^\(([a-z])\)\s*(.*)/i);
      if (letterMatch) {
        if (currentItem) {
          items.push(currentItem);
        }
        currentItem = {
          letter: letterMatch[1].toLowerCase(),
          content: [this.cleanText(letterMatch[2].trim())]
        };
        continue;
      }
      
      // Check for numbered list items (1), (2), etc.
      const numberMatch = trimmedLine.match(/^\((\d+)\)\s*(.*)/);
      if (numberMatch) {
        if (currentItem) {
          items.push(currentItem);
        }
        currentItem = {
          number: numberMatch[1],
          content: [this.cleanText(numberMatch[2].trim())]
        };
        continue;
      }
      
      // Check for Roman numerals (i), (ii), etc.
      const romanMatch = trimmedLine.match(/^\(([ivx]+)\)\s*(.*)/i);
      if (romanMatch) {
        if (currentItem) {
          items.push(currentItem);
        }
        currentItem = {
          number: romanMatch[1].toLowerCase(),
          content: [this.cleanText(romanMatch[2].trim())]
        };
        continue;
      }
      
      // If we're in a list item and this line continues it
      if (currentItem && trimmedLine && !trimmedLine.match(/^\([a-z0-9]\)/i)) {
        currentItem.content.push(this.cleanText(trimmedLine));
      } else {
        // Finalize current list item
        if (currentItem) {
          items.push(currentItem);
          currentItem = null;
        }
        
        // Add as regular text
        if (trimmedLine && !this.isPageArtifact(trimmedLine)) {
          items.push(this.cleanText(trimmedLine));
        }
      }
    }
    
    // Don't forget the last item
    if (currentItem) {
      items.push(currentItem);
    }
    
    // If no structured items found, return the entire content as paragraphs
    if (items.length === 0 && content.trim()) {
      const paragraphs = content.split(/\n\s*\n/).filter(p => {
        const trimmed = p.trim();
        return trimmed && !this.isPageArtifact(trimmed) && trimmed.length > 10;
      });
      
      if (paragraphs.length > 0) {
        return paragraphs.map(p => this.cleanText(p));
      }
      
      return [this.cleanText(content)];
    }
    
    return items;
  }

  /**
   * Check if a line is likely a page artifact
   */
  private static isPageArtifact(line: string): boolean {
    const trimmed = line.trim();
    return /^[A-Z]\d+$/.test(trimmed) || // Page numbers like A131
           /^\d+$/.test(trimmed) || // Standalone numbers
           trimmed.length < 3 || // Too short to be meaningful
           /^[\.\-\s]+$/.test(trimmed); // Only dots, dashes, or spaces
  }

  private static cleanSectionTitle(title: string): string {
    return title
      .replace(/[—:\-]+$/, '')
      .replace(/^[—:\-]+/, '')
      .trim();
  }

  private static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[—:\-]\s*$/, '')
      .replace(/^\s*[—:\-]\s*/, '')
      .trim();
  }

  private static extractSchedules(text: string): Schedule[] {
    const schedules: Schedule[] = [];
    const scheduleNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    
    scheduleNames.forEach((name, index) => {
      const scheduleNumber = index + 1;
      schedules.push({
        id: `sch${scheduleNumber}`,
        schedule: `sch${scheduleNumber}`,
        scheduleNumber,
        scheduleTitle: `${name} Schedule`,
        markdownContent: [this.getScheduleDescription(name)]
      });
    });
    
    return schedules;
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

  // Generate table of contents from structured document
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
   * Utility method to get a specific section by ID
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

  /**
   * Utility method to search sections by title or content
   */
  static searchSections(structuredDoc: StructuredDocument, query: string): Section[] {
    const results: Section[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const chapter of structuredDoc.chapters) {
      for (const part of chapter.parts) {
        for (const section of part.sections) {
          // Search in section title
          if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
            results.push(section);
            continue;
          }
          
          // Search in section content
          const contentText = this.flattenContent(section.markdownContent).toLowerCase();
          if (contentText.includes(lowerQuery)) {
            results.push(section);
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Flatten content for searching
   */
  private static flattenContent(content: ContentItem[]): string {
    return content.map(item => {
      if (typeof item === 'string') {
        return item;
      } else if ('letter' in item) {
        return `(${item.letter}) ${this.flattenContent(item.content)}`;
      } else if ('number' in item) {
        return `(${item.number}) ${this.flattenContent(item.content)}`;
      }
      return '';
    }).join(' ');
  }
}


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

// // Updated to support complex nested content
// export interface Section {
//   id: string;
//   section: string;
//   sectionNumber: number;
//   sectionTitle: string;
//   markdownContent: ContentItem[];
// }

// // Content item types to support nested structures
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
//     return yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
//   }

//   private static extractCommencementDate(text: string): string {
//     const dateMatch = text.match(/\[(\d+(?:st|nd|rd|th)?\s+Day\s+of\s+\w+,\s*\d{4})\]/i);
//     if (dateMatch) {
//       const dateStr = dateMatch[1];
//       const dayMatch = dateStr.match(/(\d+)/);
//       const monthMatch = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
//       const yearMatch = dateStr.match(/(\d{4})/);
      
//       if (dayMatch && monthMatch && yearMatch) {
//         const months: { [key: string]: string } = {
//           'january': '01', 'february': '02', 'march': '03', 'april': '04',
//           'may': '05', 'june': '06', 'july': '07', 'august': '08',
//           'september': '09', 'october': '10', 'november': '11', 'december': '12'
//         };
        
//         const day = dayMatch[1].padStart(2, '0');
//         const month = months[monthMatch[1].toLowerCase()];
//         const year = yearMatch[1];
        
//         return `${year}-${month}-${day}`;
//       }
//     }
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
    
//     // Enhanced section regex to capture subsections properly
//     const sectionRegex = /^(\d+)\.\s*(?:\((\d+)\))?\s*—?\s*([^\n]+)([\s\S]*?)(?=^\d+\.\s+|^CHAPTER\s+|^PART\s+|^SCHEDULE\s+|$)/gim;
//     let match;
    
//     while ((match = sectionRegex.exec(content)) !== null) {
//       const sectionNumber = parseInt(match[1]);
//       const subsection = match[2];
//       let sectionTitle = match[3].trim();
//       let sectionContent = match[4].trim();
      
//       // Skip if we've already seen this section number
//       if (seenSections.has(sectionNumber)) continue;
//       seenSections.add(sectionNumber);
      
//       // Clean up section title
//       sectionTitle = this.cleanSectionTitle(sectionTitle);
      
//       // Handle subsections in titles
//       if (subsection) {
//         sectionTitle = `(${subsection}) ${sectionTitle}`;
//       }
      
//       // Parse the content into structured format
//       const structuredContent = this.parseSectionContent(sectionContent);
      
//       // Only include if we have meaningful content
//       if (sectionTitle && (structuredContent.length > 0 || sectionTitle.length > 5)) {
//         sections.push({
//           id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
//           section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
//           sectionNumber,
//           sectionTitle,
//           markdownContent: structuredContent
//         });
//       }
//     }
    
//     // Sort sections by section number
//     return sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
//   }

//   /**
//    * Parse section content into structured format with proper nested lists
//    */
//   private static parseSectionContent(content: string): ContentItem[] {
//     const items: ContentItem[] = [];
    
//     if (!content.trim()) return items;

//     // Split by lines and process
//     const lines = content.split('\n').filter(line => line.trim());
    
//     let i = 0;
//     while (i < lines.length) {
//       const line = lines[i].trim();
      
//       // Check for lettered list items (a), b), etc. with proper nesting
//       const letterMatch = line.match(/^\(([a-z])\)\s*(.*)/i);
//       if (letterMatch) {
//         const letter = letterMatch[1].toLowerCase();
//         const itemContent = letterMatch[2].trim();
        
//         const { subItems, nextIndex } = this.extractSubItems(lines, i + 1);
        
//         if (subItems.length > 0) {
//           items.push({
//             letter,
//             content: [itemContent, ...subItems]
//           });
//           i = nextIndex;
//         } else {
//           items.push({
//             letter,
//             content: [itemContent]
//           });
//           i++;
//         }
//         continue;
//       }
      
//       // Check for numbered list items (1), 2), etc.
//       const numberMatch = line.match(/^\((\d+)\)\s*(.*)/);
//       if (numberMatch) {
//         items.push({
//           number: numberMatch[1],
//           content: [numberMatch[2].trim()]
//         });
//         i++;
//         continue;
//       }
      
//       // Check for Roman numeral sub-items (i), (ii), etc.
//       const romanMatch = line.match(/^\(?(i|ii|iii|iv|v|vi|vii|viii|ix|x)\)?\s*(.*)/i);
//       if (romanMatch) {
//         items.push({
//           number: romanMatch[1].toLowerCase(),
//           content: [romanMatch[2].trim()]
//         });
//         i++;
//         continue;
//       }
      
//       // Check for subsections like (1), (2), etc.
//       const subsectionMatch = line.match(/^\((\d+)\)\s*—?\s*(.*)/);
//       if (subsectionMatch) {
//         items.push(`(${subsectionMatch[1]}) ${subsectionMatch[2].trim()}`);
//         i++;
//         continue;
//       }
      
//       // Regular text line
//       if (line && !line.match(/^\s*$/)) {
//         // Clean up the line text
//         const cleanedLine = this.cleanLineText(line);
//         if (cleanedLine) {
//           items.push(cleanedLine);
//         }
//       }
      
//       i++;
//     }
    
//     return items;
//   }

//   /**
//    * Extract sub-items recursively
//    */
//   private static extractSubItems(lines: string[], startIndex: number): { subItems: ContentItem[], nextIndex: number } {
//     const subItems: ContentItem[] = [];
//     let i = startIndex;
    
//     while (i < lines.length) {
//       const line = lines[i].trim();
      
//       // Check for Roman numeral sub-items
//       const romanMatch = line.match(/^\(?(i|ii|iii|iv|v|vi|vii|viii|ix|x)\)?\s*(.*)/i);
//       if (romanMatch) {
//         const number = romanMatch[1].toLowerCase();
//         const content = romanMatch[2].trim();
        
//         // Check if this sub-item has its own sub-items
//         const { subItems: nestedSubItems, nextIndex } = this.extractNestedSubItems(lines, i + 1);
        
//         if (nestedSubItems.length > 0) {
//           subItems.push({
//             number,
//             content: [content, ...nestedSubItems]
//           });
//           i = nextIndex;
//         } else {
//           subItems.push({
//             number,
//             content: [content]
//           });
//           i++;
//         }
//         continue;
//       }
      
//       // Check for numbered sub-items (1), (2), etc.
//       const numberMatch = line.match(/^\((\d+)\)\s*(.*)/);
//       if (numberMatch) {
//         subItems.push({
//           number: numberMatch[1],
//           content: [numberMatch[2].trim()]
//         });
//         i++;
//         continue;
//       }
      
//       // If we hit a line that doesn't match sub-item patterns, break
//       if (!line.match(/^\(?(i|ii|iii|iv|v|vi|vii|viii|ix|x|\d+)\)?\s*/i)) {
//         break;
//       }
      
//       i++;
//     }
    
//     return { subItems, nextIndex: i };
//   }

//   /**
//    * Extract nested sub-items (third level)
//    */
//   private static extractNestedSubItems(lines: string[], startIndex: number): { subItems: ContentItem[], nextIndex: number } {
//     const subItems: ContentItem[] = [];
//     let i = startIndex;
    
//     while (i < lines.length) {
//       const line = lines[i].trim();
      
//       // Check for numbered items at third level
//       const numberMatch = line.match(/^\((\d+)\)\s*(.*)/);
//       if (numberMatch) {
//         subItems.push({
//           number: numberMatch[1],
//           content: [numberMatch[2].trim()]
//         });
//         i++;
//         continue;
//       }
      
//       // Check for lettered items at third level
//       const letterMatch = line.match(/^\(([a-z])\)\s*(.*)/i);
//       if (letterMatch) {
//         subItems.push({
//           letter: letterMatch[1].toLowerCase(),
//           content: [letterMatch[2].trim()]
//         });
//         i++;
//         continue;
//       }
      
//       // If we hit a line that doesn't match nested sub-item patterns, break
//       if (!line.match(/^\((\d+|[a-z])\)\s*/i)) {
//         break;
//       }
      
//       i++;
//     }
    
//     return { subItems, nextIndex: i };
//   }

//   private static cleanSectionTitle(title: string): string {
//     // Remove trailing dashes and colons
//     let cleaned = title.replace(/[—:\-]+$/, '').trim();
    
//     // Capitalize first letter
//     if (cleaned.length > 0) {
//       cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
//     }
    
//     return cleaned;
//   }

//   private static cleanLineText(line: string): string {
//     // Remove excessive whitespace
//     return line.replace(/\s+/g, ' ').trim();
//   }

//   private static extractSchedules(text: string): Schedule[] {
//     const schedules: Schedule[] = [];
//     const scheduleRegex = /(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+Schedule/gi;
//     let match;
//     let scheduleNumber = 1;
    
//     const seenSchedules = new Set();
    
//     while ((match = scheduleRegex.exec(text)) !== null) {
//       const scheduleName = match[1];
//       const scheduleKey = scheduleName.toLowerCase();
      
//       // Avoid duplicates
//       if (!seenSchedules.has(scheduleKey)) {
//         seenSchedules.add(scheduleKey);
        
//         schedules.push({
//           id: `sch${scheduleNumber}`,
//           schedule: `sch${scheduleNumber}`,
//           scheduleNumber,
//           scheduleTitle: `${scheduleName} Schedule`,
//           markdownContent: [this.extractScheduleContent(text, scheduleName)]
//         });
        
//         scheduleNumber++;
//       }
//     }
    
//     return schedules;
//   }

//   private static extractScheduleContent(text: string, scheduleName: string): string {
//     const scheduleContents: { [key: string]: string } = {
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
    
//     return scheduleContents[scheduleName] || `Provisions and regulations for the ${scheduleName} Schedule.`;
//   }

//   private static extractMetadata(text: string): DocumentMetadata {
//     const sourceMatch = text.match(/Official Gazette\s*No\.\s*(\d+).*?(\d+(?:st|nd|rd|th)?\s+\w+\s+\d{4})/i);
//     const publisherMatch = text.match(/Printed and Published by ([^\n]+)/i);
//     const pageRangeMatch = text.match(/A(\d+)[–\-]A?(\d+)/);
    
//     return {
//       source: sourceMatch ? `Federal Republic of Nigeria Official Gazette No. ${sourceMatch[1]} (${sourceMatch[2]})` : 'Federal Republic of Nigeria Official Gazette',
//       publisher: publisherMatch ? publisherMatch[1].trim() : 'Federal Government Printer, Lagos, Nigeria',
//       pageRange: pageRangeMatch ? `A${pageRangeMatch[1]}–A${pageRangeMatch[2]}` : 'A121–A370',
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
//     return yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
//   }

//   private static extractCommencementDate(text: string): string {
//     const dateMatch = text.match(/\[(\d+(?:st|nd|rd|th)?\s+Day\s+of\s+\w+,\s*\d{4})\]/i);
//     if (dateMatch) {
//       const dateStr = dateMatch[1];
//       const dayMatch = dateStr.match(/(\d+)/);
//       const monthMatch = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
//       const yearMatch = dateStr.match(/(\d{4})/);
      
//       if (dayMatch && monthMatch && yearMatch) {
//         const months: { [key: string]: string } = {
//           'january': '01', 'february': '02', 'march': '03', 'april': '04',
//           'may': '05', 'june': '06', 'july': '07', 'august': '08',
//           'september': '09', 'october': '10', 'november': '11', 'december': '12'
//         };
        
//         const day = dayMatch[1].padStart(2, '0');
//         const month = months[monthMatch[1].toLowerCase()];
//         const year = yearMatch[1];
        
//         return `${year}-${month}-${day}`;
//       }
//     }
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
//     const sectionRegex = /^(\d+)\.\s+([^\n]+)([\s\S]*?)(?=^\d+\.\s+|^CHAPTER\s+|^PART\s+|$)/gim;
//     let match;
    
//     while ((match = sectionRegex.exec(content)) !== null) {
//       const sectionNumber = parseInt(match[1]);
//       const sectionTitle = match[2].trim();
//       let sectionContent = match[3].trim();
      
//       // Skip if we've already seen this section number
//       if (seenSections.has(sectionNumber)) continue;
//       seenSections.add(sectionNumber);
      
//       // Clean up the content
//       sectionContent = this.cleanSectionContent(sectionContent);
      
//       // Only include if we have meaningful content
//       if (sectionTitle && (sectionContent || sectionTitle.length > 5)) {
//         const finalContent = sectionContent || sectionTitle;
        
//         sections.push({
//           id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
//           section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
//           sectionNumber,
//           sectionTitle,
//           markdownContent: finalContent
//         });
//       }
//     }
    
//     // Fallback: try simple section number pattern
//     if (sections.length === 0) {
//       const simpleSectionRegex = /^(\d+)\.\s+([^\n]+)/gim;
//       let simpleMatch;
      
//       while ((simpleMatch = simpleSectionRegex.exec(content)) !== null) {
//         const sectionNumber = parseInt(simpleMatch[1]);
//         const sectionTitle = simpleMatch[2].trim();
        
//         if (!seenSections.has(sectionNumber) && sectionTitle.length > 5) {
//           seenSections.add(sectionNumber);
          
//           sections.push({
//             id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
//             section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
//             sectionNumber,
//             sectionTitle,
//             markdownContent: sectionTitle
//           });
//         }
//       }
//     }
    
//     // Sort sections by section number
//     return sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
//   }

//   private static extractSchedules(text: string): Schedule[] {
//     const schedules: Schedule[] = [];
//     const scheduleRegex = /(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+Schedule/gi;
//     let match;
//     let scheduleNumber = 1;
    
//     const seenSchedules = new Set();
    
//     while ((match = scheduleRegex.exec(text)) !== null) {
//       const scheduleName = match[1];
//       const scheduleKey = scheduleName.toLowerCase();
      
//       // Avoid duplicates
//       if (!seenSchedules.has(scheduleKey)) {
//         seenSchedules.add(scheduleKey);
        
//         schedules.push({
//           id: `sch${scheduleNumber}`,
//           schedule: `sch${scheduleNumber}`,
//           scheduleNumber,
//           scheduleTitle: `${scheduleName} Schedule`,
//           markdownContent: this.extractScheduleContent(text, scheduleName)
//         });
        
//         scheduleNumber++;
//       }
//     }
    
//     return schedules;
//   }

//   private static extractScheduleContent(text: string, scheduleName: string): string {
//     const scheduleContents: { [key: string]: string } = {
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
    
//     return scheduleContents[scheduleName] || `Provisions and regulations for the ${scheduleName} Schedule.`;
//   }

//   private static extractMetadata(text: string): DocumentMetadata {
//     const sourceMatch = text.match(/Official Gazette\s*No\.\s*(\d+).*?(\d+(?:st|nd|rd|th)?\s+\w+\s+\d{4})/i);
//     const publisherMatch = text.match(/Printed and Published by ([^\n]+)/i);
//     const pageRangeMatch = text.match(/A(\d+)[–\-]A?(\d+)/);
    
//     return {
//       source: sourceMatch ? `Federal Republic of Nigeria Official Gazette No. ${sourceMatch[1]} (${sourceMatch[2]})` : 'Federal Republic of Nigeria Official Gazette',
//       publisher: publisherMatch ? publisherMatch[1].trim() : 'Federal Government Printer, Lagos, Nigeria',
//       pageRange: pageRangeMatch ? `A${pageRangeMatch[1]}–A${pageRangeMatch[2]}` : 'A121–A370',
//       format: 'markdown',
//       encoding: 'UTF-8'
//     };
//   }

//   private static cleanSectionContent(content: string): string {
//     if (!content) return '';
    
//     return content
//       .replace(/\r\n/g, '\n')
//       .replace(/\r/g, '\n')
//       .replace(/\n{3,}/g, '\n\n')
//       .replace(/[ \t]{2,}/g, ' ')
//       .replace(/\n\s+/g, '\n')
//       .replace(/\s+\n/g, '\n')
//       .trim();
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

//   // Debug method to test section extraction
//   static debugSectionExtraction(text: string, chapterNumber: number, partNumber: number): void {
//     console.log(`=== Debugging Chapter ${chapterNumber}, Part ${partNumber} ===`);
    
//     const sectionRegex = /^(\d+)\.\s+([^\n]+)([\s\S]*?)(?=^\d+\.\s+|^CHAPTER\s+|^PART\s+|$)/gim;
//     let match;
//     let foundCount = 0;
    
//     while ((match = sectionRegex.exec(text)) !== null) {
//       foundCount++;
//       console.log(`Found section ${match[1]}: "${match[2].trim()}"`);
//       console.log(`Content sample: ${match[3].trim().substring(0, 100)}...`);
//     }
    
//     console.log(`Total sections found: ${foundCount}`);
//     console.log('=== End Debug ===');
//   }
// }


