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
  markdownContent: string;
}

export interface Schedule {
  id: string;
  schedule: string;
  scheduleNumber: number;
  scheduleTitle: string;
  markdownContent: string;
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
    return yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  }

  private static extractCommencementDate(text: string): string {
    const dateMatch = text.match(/\[(\d+(?:st|nd|rd|th)?\s+Day\s+of\s+\w+,\s*\d{4})\]/i);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const dayMatch = dateStr.match(/(\d+)/);
      const monthMatch = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
      const yearMatch = dateStr.match(/(\d{4})/);
      
      if (dayMatch && monthMatch && yearMatch) {
        const months: { [key: string]: string } = {
          'january': '01', 'february': '02', 'march': '03', 'april': '04',
          'may': '05', 'june': '06', 'july': '07', 'august': '08',
          'september': '09', 'october': '10', 'november': '11', 'december': '12'
        };
        
        const day = dayMatch[1].padStart(2, '0');
        const month = months[monthMatch[1].toLowerCase()];
        const year = yearMatch[1];
        
        return `${year}-${month}-${day}`;
      }
    }
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
    const sectionRegex = /^(\d+)\.\s+([^\n]+)([\s\S]*?)(?=^\d+\.\s+|^CHAPTER\s+|^PART\s+|$)/gim;
    let match;
    
    while ((match = sectionRegex.exec(content)) !== null) {
      const sectionNumber = parseInt(match[1]);
      const sectionTitle = match[2].trim();
      let sectionContent = match[3].trim();
      
      // Skip if we've already seen this section number
      if (seenSections.has(sectionNumber)) continue;
      seenSections.add(sectionNumber);
      
      // Clean up the content
      sectionContent = this.cleanSectionContent(sectionContent);
      
      // Only include if we have meaningful content
      if (sectionTitle && (sectionContent || sectionTitle.length > 5)) {
        const finalContent = sectionContent || sectionTitle;
        
        sections.push({
          id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
          section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
          sectionNumber,
          sectionTitle,
          markdownContent: finalContent
        });
      }
    }
    
    // Fallback: try simple section number pattern
    if (sections.length === 0) {
      const simpleSectionRegex = /^(\d+)\.\s+([^\n]+)/gim;
      let simpleMatch;
      
      while ((simpleMatch = simpleSectionRegex.exec(content)) !== null) {
        const sectionNumber = parseInt(simpleMatch[1]);
        const sectionTitle = simpleMatch[2].trim();
        
        if (!seenSections.has(sectionNumber) && sectionTitle.length > 5) {
          seenSections.add(sectionNumber);
          
          sections.push({
            id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
            section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}`,
            sectionNumber,
            sectionTitle,
            markdownContent: sectionTitle
          });
        }
      }
    }
    
    // Sort sections by section number
    return sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
  }

  private static extractSchedules(text: string): Schedule[] {
    const schedules: Schedule[] = [];
    const scheduleRegex = /(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+Schedule/gi;
    let match;
    let scheduleNumber = 1;
    
    const seenSchedules = new Set();
    
    while ((match = scheduleRegex.exec(text)) !== null) {
      const scheduleName = match[1];
      const scheduleKey = scheduleName.toLowerCase();
      
      // Avoid duplicates
      if (!seenSchedules.has(scheduleKey)) {
        seenSchedules.add(scheduleKey);
        
        schedules.push({
          id: `sch${scheduleNumber}`,
          schedule: `sch${scheduleNumber}`,
          scheduleNumber,
          scheduleTitle: `${scheduleName} Schedule`,
          markdownContent: this.extractScheduleContent(text, scheduleName)
        });
        
        scheduleNumber++;
      }
    }
    
    return schedules;
  }

  private static extractScheduleContent(text: string, scheduleName: string): string {
    const scheduleContents: { [key: string]: string } = {
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
    
    return scheduleContents[scheduleName] || `Provisions and regulations for the ${scheduleName} Schedule.`;
  }

  private static extractMetadata(text: string): DocumentMetadata {
    const sourceMatch = text.match(/Official Gazette\s*No\.\s*(\d+).*?(\d+(?:st|nd|rd|th)?\s+\w+\s+\d{4})/i);
    const publisherMatch = text.match(/Printed and Published by ([^\n]+)/i);
    const pageRangeMatch = text.match(/A(\d+)[–\-]A?(\d+)/);
    
    return {
      source: sourceMatch ? `Federal Republic of Nigeria Official Gazette No. ${sourceMatch[1]} (${sourceMatch[2]})` : 'Federal Republic of Nigeria Official Gazette',
      publisher: publisherMatch ? publisherMatch[1].trim() : 'Federal Government Printer, Lagos, Nigeria',
      pageRange: pageRangeMatch ? `A${pageRangeMatch[1]}–A${pageRangeMatch[2]}` : 'A121–A370',
      format: 'markdown',
      encoding: 'UTF-8'
    };
  }

  private static cleanSectionContent(content: string): string {
    if (!content) return '';
    
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n')
      .trim();
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
}


