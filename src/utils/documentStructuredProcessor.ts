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
  parts?: Part[];
  schedules: Schedule[];
  metadata: DocumentMetadata;
}

export class DocumentStructuredProcessor {
  /**
   * Convert processed content to structured API response format
   * EACH DOCUMENT TYPE HAS ITS OWN DEDICATED PROCESSOR
   */
  static processToStructuredFormat(
    processedContent: ProcessedContent,
    documentId: string,
    originalFileName: string
  ): StructuredDocument {
    const { rawText } = processedContent;

    console.log('=== PROCESSING DOCUMENT ===');
    console.log('Document filename:', originalFileName);
    console.log('Text length:', rawText.length);

    const documentType = this.detectDocumentTypeStrict(rawText, originalFileName);
    console.log('Detected document type:', documentType);

    switch (documentType) {
      case 'nigeria-tax-act':
        console.log('>>> ROUTING TO NIGERIA TAX ACT PROCESSOR <<<');
        return this.processNigeriaTaxAct(rawText, documentId);

      case 'nigeria-tax-administration-act':
        console.log('>>> ROUTING TO NIGERIA TAX ADMINISTRATION ACT PROCESSOR <<<');
        return this.processNigeriaTaxAdministrationAct(rawText, documentId);
        
      case 'nigeria-revenue-service':
        console.log('>>> ROUTING TO NIGERIA REVENUE SERVICE PROCESSOR <<<');
        return this.processNigeriaRevenueService(rawText, documentId);
      
      case 'joint-revenue-board':
        console.log('>>> ROUTING TO JOINT REVENUE BOARD PROCESSOR <<<');
        return this.processJointRevenueBoard(rawText, documentId);
      
      case 'petroleum-industry-act':
        console.log('>>> ROUTING TO PIA PROCESSOR <<<');
        return this.processPetroleumIndustryAct(rawText, documentId);
      
      default:
        console.log('>>> UNKNOWN DOCUMENT - FALLBACK TO PIA <<<');
        return this.processPetroleumIndustryAct(rawText, documentId);
    }
  }

  private static detectDocumentTypeStrict(
    text: string, 
    filename: string
  ): 'nigeria-tax-act' | 'nigeria-tax-administration-act' | 'nigeria-revenue-service' | 'joint-revenue-board' | 'petroleum-industry-act' {
    const upperText = text.toUpperCase();
    const upperFilename = filename.toUpperCase();

    // ===== NIGERIA TAX ADMINISTRATION ACT - CHECK FIRST =====
    // const ntaaSpecificPhrases = [
    //   'RETURNS, ASSESSMENT AND PAYMENTS',
    //   'OBJECTIVE AND JURISDICTION OF TAX AUTHORITIES',
    //   'ACCREDITATION OF TAX AGENTS',
    //   'DISCLOSURE OF TAX PLANNING',
    //   'PROHIBITED TAX AVOIDANCE ARRANGEMENT',
    //   'PAY AS YOU EARN',
    //   'TAX INCENTIVE RETURNS',
    //   'CALL FOR RETURNS, BOOKS, DOCUMENTS AND INFORMATION'
    // ];

    // for (const phrase of ntaaSpecificPhrases) {
    //   if (upperText.includes(phrase)) {
    //     console.log(`[DETECTION] Found NTAA unique phrase: "${phrase}"`);
    //     return 'nigeria-tax-administration-act';
    //   }
    // }

    // if (upperText.includes('TAX ADMINISTRATION ACT') && 
    //     upperText.includes('CHAPTER ONE') &&
    //     upperText.includes('RETURNS')) {
    //   console.log('[DETECTION] Found Tax Administration Act with chapter structure');
    //   return 'nigeria-tax-administration-act';
    // }

    const ntaaPhrases = [
      'TAX ADMINISTRATION ACT',
      'RETURNS, ASSESSMENT AND PAYMENTS',
      'OBJECTIVE AND JURISDICTION OF TAX AUTHORITIES',
      'ACCREDITATION OF TAX AGENTS',
      'DISCLOSURE OF TAX PLANNING',
      'PROHIBITED TAX AVOIDANCE ARRANGEMENT',
      'PAY AS YOU EARN',
      'TAX INCENTIVE RETURNS',
      'CALL FOR RETURNS, BOOKS, DOCUMENTS AND INFORMATION'
    ];

  // Count how many NTAA phrases are present
  let ntaaPhraseCount = 0;
  for (const phrase of ntaaPhrases) {
    if (upperText.includes(phrase)) {
      ntaaPhraseCount++;
    }
  }

  // CRITICAL: Require AT LEAST 3 unique NTAA phrases to confirm it's NTAA
  if (ntaaPhraseCount >= 3) {
    console.log(`[DETECTION] Found ${ntaaPhraseCount} NTAA unique phrases - confirming NTAA`);
    return 'nigeria-tax-administration-act';
  }
      if (upperText.includes('TAX ADMINISTRATION ACT') && 
          upperText.includes('CHAPTER ONE') &&
          upperText.includes('PART I — OBJECTIVE AND JURISDICTION')) {
        console.log('[DETECTION] Found NTAA with exact title and chapter structure');
        return 'nigeria-tax-administration-act';
      }

    // ===== NIGERIA TAX ACT - UNIQUE INDICATORS =====
    const taxActUniquePhrases = [
      'TAXATION OF INCOME OF PERSONS',
      'TAXATION OF INCOME FROM PETROLEUM OPERATIONS',
      'RELIEF FOR DOUBLE TAXATION',
      'TAXATION OF DUTIABLE INSTRUMENTS',
      'CAPITAL GAINS TAX ACT'
    ];

    for (const phrase of taxActUniquePhrases) {
      if (upperText.includes(phrase)) {
        console.log(`[DETECTION] Found Nigeria Tax Act unique phrase: "${phrase}"`);
        return 'nigeria-tax-act';
      }
    }

    // if (upperText.includes('NIGERIA TAX ACT') && 
    //     !upperText.includes('TAX ADMINISTRATION') &&
    //     !upperText.includes('NIGERIA REVENUE SERVICE') &&
    //     !upperText.includes('JOINT REVENUE BOARD')) {
    //   console.log('[DETECTION] Found "NIGERIA TAX ACT" without conflicting indicators');
    //   return 'nigeria-tax-act';
    // }

    if (upperText.includes('NIGERIA TAX ACT') && 
        ntaaPhraseCount < 3 &&
        !upperText.includes('TAX ADMINISTRATION')) {
      console.log('[DETECTION] Found "NIGERIA TAX ACT" without NTAA indicators');
      return 'nigeria-tax-act';
    }


    // ===== NIGERIA REVENUE SERVICE - UNIQUE INDICATORS =====
    const nrsUniquePhrases = [
      'FEDERAL INLAND REVENUE SERVICE (ESTABLISHMENT) ACT',
      'AN ACT TO REPEAL THE FEDERAL INLAND REVENUE SERVICE',
      'NIGERIA REVENUE SERVICE (ESTABLISHMENT) ACT, 2025',
      'EXECUTIVE CHAIRMAN OF THE SERVICE',
      'GOVERNING BOARD OF THE SERVICE',
      'TECHNICAL COMMITTEE OF THE BOARD'
    ];

    for (const phrase of nrsUniquePhrases) {
      if (upperText.includes(phrase)) {
        console.log(`[DETECTION] Found Nigeria Revenue Service unique phrase: "${phrase}"`);
        return 'nigeria-revenue-service';
      }
    }

    if (upperText.includes('NIGERIA REVENUE SERVICE') && 
        upperText.includes('ESTABLISHMENT') &&
        !upperText.includes('JOINT REVENUE BOARD')) {
      console.log('[DETECTION] Found "NIGERIA REVENUE SERVICE" + "ESTABLISHMENT" without "JOINT"');
      return 'nigeria-revenue-service';
    }

    // ===== JOINT REVENUE BOARD - UNIQUE INDICATORS =====
    const jrbUniquePhrases = [
      'JOINT REVENUE BOARD (ESTABLISHMENT) ACT',
      'TAX APPEAL TRIBUNAL',
      'OFFICE OF THE TAX OMBUD',
      'TAX OMBUD',
      'COORDINATING SECRETARY TO THE TRIBUNAL',
      'EXPLANATORY MEMORADUM'
    ];

    for (const phrase of jrbUniquePhrases) {
      if (upperText.includes(phrase)) {
        console.log(`[DETECTION] Found Joint Revenue Board unique phrase: "${phrase}"`);
        return 'joint-revenue-board';
      }
    }

    // ===== PETROLEUM INDUSTRY ACT - UNIQUE INDICATORS =====
    const piaUniquePhrases = [
      'PETROLEUM INDUSTRY ACT',
      'UPSTREAM PETROLEUM OPERATIONS',
      'HOST COMMUNITIES',
      'PETROLEUM INDUSTRY FISCAL FRAMEWORK'
    ];

    for (const phrase of piaUniquePhrases) {
      if (upperText.includes(phrase)) {
        console.log(`[DETECTION] Found PIA unique phrase: "${phrase}"`);
        return 'petroleum-industry-act';
      }
    }

    if (upperFilename.includes('PIA') || upperFilename.includes('PETROLEUM')) {
      return 'petroleum-industry-act';
    }

    return 'petroleum-industry-act';
  }

  // ========================================================================
  // NIGERIA TAX ACT PROCESSOR - UNCHANGED
  // ========================================================================

  private static processNigeriaTaxAct(text: string, documentId: string): StructuredDocument {
    console.log('=== NIGERIA TAX ACT - DEDICATED PROCESSOR ===');
    
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[—–]/g, '-')
      .trim();

    const chapterDefinitions = [
      { number: 1, title: 'OBJECTIVE AND APPLICATION', startSection: 1, endSection: 2 },
      { number: 2, title: 'TAXATION OF INCOME OF PERSONS', startSection: 3, endSection: 64 },
      { number: 3, title: 'TAXATION OF INCOME FROM PETROLEUM OPERATIONS', startSection: 65, endSection: 118 },
      { number: 4, title: 'RELIEF FOR DOUBLE TAXATION', startSection: 119, endSection: 122 },
      { number: 5, title: 'TAXATION OF DUTIABLE INSTRUMENTS', startSection: 123, endSection: 142 },
      { number: 6, title: 'VALUE ADDED TAX', startSection: 143, endSection: 157 },
      { number: 7, title: 'SURCHARGE', startSection: 158, endSection: 161 },
      { number: 8, title: 'TAX INCENTIVES', startSection: 162, endSection: 188 },
      { number: 9, title: 'GENERAL PROVISIONS', startSection: 189, endSection: 202 }
    ];

    const contentStartIndex = this.nta_findContentStart(normalizedText);
    let contentText = normalizedText;
    if (contentStartIndex !== -1) {
      contentText = normalizedText.substring(contentStartIndex);
    }

    const scheduleStartIndex = contentText.indexOf('FIRST SCHEDULE');
    let chaptersText = contentText;
    if (scheduleStartIndex !== -1) {
      chaptersText = contentText.substring(0, scheduleStartIndex);
    }

    const chapters = this.nta_splitBySections(chaptersText, chapterDefinitions);
    const schedules = this.nta_extractSchedules(normalizedText);

    const title = this.nta_extractTitle(normalizedText);
    const actNumber = this.nta_extractActNumber(normalizedText);
    const year = this.nta_extractYear(normalizedText);
    const commencementDate = this.nta_extractCommencementDate(normalizedText);
    const description = this.nta_extractDescription();

    return {
      id: documentId,
      title,
      actNumber,
      year,
      commencementDate,
      description,
      chapters: chapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
      schedules,
      metadata: {
        source: 'Federal Republic of Nigeria Official Gazette',
        publisher: 'Federal Government Printer, Abuja, Nigeria',
        pageRange: 'A1–A250',
        format: 'markdown',
        encoding: 'UTF-8'
      }
    };
  }

  private static nta_findContentStart(text: string): number {
    const patterns = [
      /\n\s*1\.\s+The\s+objective/i,
      /\n\s*1\.\s+Objective/i,
      /^1\.\s+The\s+objective/i,
      /^1\.\s+Objective/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        const textBefore = text.substring(0, match.index);
        const lastChapterIndex = textBefore.lastIndexOf('CHAPTER');
        if (lastChapterIndex !== -1) {
          return lastChapterIndex;
        }
        return match.index;
      }
    }
    return -1;
  }

  private static nta_splitBySections(
    text: string,
    chapterDefinitions: Array<{ number: number, title: string, startSection: number, endSection: number }>
  ): Chapter[] {
    const chapters: Chapter[] = [];
    
    const sectionPositions: Array<{ number: number, index: number }> = [];
    const sectionRegex = /(?:^|\n)(\d{1,3})\.(?:[—–-]?\s*)/g;
    let match;
    
    while ((match = sectionRegex.exec(text)) !== null) {
      if (match.index === undefined) continue;
      const sectionNumber = parseInt(match[1]);
      if (sectionNumber >= 1 && sectionNumber <= 202) {
        sectionPositions.push({ number: sectionNumber, index: match.index });
      }
    }
    sectionPositions.sort((a, b) => a.index - b.index);

    for (let i = 0; i < chapterDefinitions.length; i++) {
      const def = chapterDefinitions[i];
      const startSectionPos = sectionPositions.find(sp => sp.number === def.startSection);
      
      if (!startSectionPos) {
        chapters.push(this.nta_createEmptyChapter(def.number, def.title));
        continue;
      }

      let endIndex = text.length;
      if (i + 1 < chapterDefinitions.length) {
        const nextSectionPos = sectionPositions.find(sp => sp.number === chapterDefinitions[i + 1].startSection);
        if (nextSectionPos) endIndex = nextSectionPos.index;
      }

      let chapterContent = text.substring(startSectionPos.index, endIndex).trim();
      let chapterTitle = def.title;
      
      const textBefore = text.substring(0, startSectionPos.index);
      const lastChapterIndex = textBefore.lastIndexOf('CHAPTER');
      if (lastChapterIndex !== -1) {
        const chapterHeaderLine = textBefore.substring(lastChapterIndex, startSectionPos.index).split('\n')[0];
        const titleMatch = chapterHeaderLine.match(/[—–-]\s*([^\n]+)/i);
        if (titleMatch) chapterTitle = titleMatch[1].trim().toUpperCase();
      }

      const parts = this.nta_extractParts(chapterContent, def.number, def.startSection, def.endSection);
      
      chapters.push({
        id: `ch${def.number}`,
        chapter: `ch${def.number}`,
        chapterNumber: def.number,
        chapterTitle,
        parts
      });
    }

    return chapters;
  }

  private static nta_extractParts(content: string, chapterNumber: number, startSection: number, endSection: number): Part[] {
    const parts: Part[] = [];
    if (!content.trim()) return parts;

    let cleanContent = content.replace(/^CHAPTER\s+(?:ONE|1|TWO|2|THREE|3|FOUR|4|FIVE|5|SIX|6|SEVEN|7|EIGHT|8|NINE|9|TEN|10)[—–-][^\n]*\n?/i, '');

    const partHeaders: Array<{ title: string, index: number, header: string }> = [];
    const partRegex = /PART\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X|1|2|3|4|5|6|7|8|9|10|ONE|TWO|THREE|FOUR|FIVE)[—–-][^\n]*/gi;
    let match;
    
    while ((match = partRegex.exec(cleanContent)) !== null) {
      if (match.index === undefined) continue;
      let partTitle = '';
      const titleMatch = match[0].match(/[—–-]\s*([^\n]+)/i);
      if (titleMatch) partTitle = titleMatch[1].trim().toUpperCase();
      partHeaders.push({ title: partTitle, index: match.index, header: match[0] });
    }
    partHeaders.sort((a, b) => a.index - b.index);

    if (partHeaders.length === 0) {
      const sections = this.nta_extractSections(cleanContent, chapterNumber, 1, startSection, endSection);
      parts.push({
        id: `ch${chapterNumber}-pt1`,
        part: `ch${chapterNumber}-pt1`,
        partNumber: 1,
        partTitle: 'PROVISIONS',
        sections
      });
      return parts;
    }

    for (let i = 0; i < partHeaders.length; i++) {
      const current = partHeaders[i];
      let partEndIndex = cleanContent.length;
      if (i + 1 < partHeaders.length) partEndIndex = partHeaders[i + 1].index;
      
      const partContent = cleanContent.substring(current.index + current.header.length, partEndIndex).trim();
      const sections = this.nta_extractSections(partContent, chapterNumber, i + 1, startSection, endSection);
      
      parts.push({
        id: `ch${chapterNumber}-pt${i + 1}`,
        part: `ch${chapterNumber}-pt${i + 1}`,
        partNumber: i + 1,
        partTitle: current.title || `PART ${i + 1}`,
        sections
      });
    }
    return parts;
  }

  private static nta_extractSections(content: string, chapterNumber: number, partNumber: number, startSection: number, endSection: number): Section[] {
    const sections: Section[] = [];
    if (!content.trim()) return sections;

    const sectionRegex = /(?:^|\n)(\d{1,3})\.(?:[—–-]?\s*)?([^\n]*)/g;
    const sectionMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];
    let match;

    while ((match = sectionRegex.exec(content)) !== null) {
      if (match.index === undefined) continue;
      const sectionNumber = parseInt(match[1]);
      if (sectionNumber < startSection || sectionNumber > endSection) continue;
      let sectionTitle = match[2].trim();
      sectionTitle = sectionTitle.replace(/^[—–.\s-]+/, '').replace(/[—–.\s-]+$/, '');
      sectionMatches.push({ number: sectionNumber, title: sectionTitle, index: match.index, fullMatch: match[0] });
    }

    for (let i = 0; i < sectionMatches.length; i++) {
      const current = sectionMatches[i];
      let sectionEnd = content.length;
      if (i + 1 < sectionMatches.length) sectionEnd = sectionMatches[i + 1].index;

      const sectionStart = current.index + current.fullMatch.length;
      let sectionContent = content.substring(sectionStart, sectionEnd).trim();

      const subsections = this.nta_extractSubsections(sectionContent, chapterNumber, partNumber, current.number);
      let mainContent = sectionContent;
      
      const firstSubMatch = /\((\d+)\)/g.exec(sectionContent);
      if (firstSubMatch && firstSubMatch.index !== undefined) {
        mainContent = sectionContent.substring(0, firstSubMatch.index).trim();
        mainContent = this.nta_cleanText(mainContent);
      }

      mainContent = this.nta_cleanText(mainContent);

      if (current.title || mainContent) {
        sections.push({
          id: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
          section: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
          sectionNumber: current.number,
          sectionTitle: current.title || `Section ${current.number}`,
          markdownContent: mainContent ? [mainContent] : []
        });
      }
      sections.push(...subsections);
    }

    return sections.sort((a, b) => {
      if (a.sectionNumber !== b.sectionNumber) return a.sectionNumber - b.sectionNumber;
      const aIsSub = a.id.includes('-us');
      const bIsSub = b.id.includes('-us');
      if (aIsSub && !bIsSub) return 1;
      if (!aIsSub && bIsSub) return -1;
      return 0;
    });
  }

  private static nta_extractSubsections(content: string, chapterNumber: number, partNumber: number, sectionNumber: number): Section[] {
    const subsections: Section[] = [];
    if (!content) return subsections;

    const subsectionRegex = /\((\d+)\)(?:\s*[—–-]?\s*)?([^\n]*)/gi;
    const positions: Array<{ number: string, title: string, index: number, fullMatch: string }> = [];
    let match;

    while ((match = subsectionRegex.exec(content)) !== null) {
      if (match.index === undefined) continue;
      let subTitle = match[2].trim().replace(/\s+/g, ' ');
      positions.push({ number: match[1], title: subTitle, index: match.index, fullMatch: match[0] });
    }

    let counter = 1;
    for (let i = 0; i < positions.length; i++) {
      const current = positions[i];
      let endIndex = content.length;
      if (i + 1 < positions.length) endIndex = positions[i + 1].index;

      const subStart = current.index + current.fullMatch.length;
      let subContent = content.substring(subStart, endIndex).trim();
      subContent = subContent.replace(/^[A-Z]\d+\s*$/gm, '').replace(/^\s*\d{1,3}\s*$/gm, '');
      subContent = subContent.replace(/\n{3,}/g, '\n\n').replace(/\s+/g, ' ').trim();

      subsections.push({
        id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${counter}`,
        section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${counter}`,
        sectionNumber,
        sectionTitle: `(${current.number})${current.title ? ' ' + current.title : ''}`,
        markdownContent: subContent ? [subContent] : []
      });
      counter++;
    }
    return subsections;
  }

  private static nta_cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/^[A-Z]\d+\s*$/gm, '').replace(/^\s*\d{1,3}\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n').replace(/\s+/g, ' ').trim();
  }

  private static nta_createEmptyChapter(chapterNumber: number, title: string): Chapter {
    return {
      id: `ch${chapterNumber}`,
      chapter: `ch${chapterNumber}`,
      chapterNumber,
      chapterTitle: title,
      parts: [{
        id: `ch${chapterNumber}-pt1`,
        part: `ch${chapterNumber}-pt1`,
        partNumber: 1,
        partTitle: 'PROVISIONS',
        sections: []
      }]
    };
  }

  private static nta_extractSchedules(text: string): Schedule[] {
    const schedules: Schedule[] = [];
    const scheduleStartIndex = text.indexOf('FIRST SCHEDULE');
    if (scheduleStartIndex === -1) return this.nta_getPlaceholderSchedules();

    const schedulesText = text.substring(scheduleStartIndex);
    const scheduleDefs = [
      { name: 'First', number: 1 }, { name: 'Second', number: 2 }, { name: 'Third', number: 3 },
      { name: 'Fourth', number: 4 }, { name: 'Fifth', number: 5 }, { name: 'Sixth', number: 6 },
      { name: 'Seventh', number: 7 }, { name: 'Eighth', number: 8 }, { name: 'Ninth', number: 9 },
      { name: 'Tenth', number: 10 }, { name: 'Eleventh', number: 11 }, { name: 'Twelfth', number: 12 },
      { name: 'Thirteenth', number: 13 }, { name: 'Fourteenth', number: 14 }
    ];

    for (const def of scheduleDefs) {
      schedules.push({
        id: `sch${def.number}`,
        schedule: `sch${def.number}`,
        scheduleNumber: def.number,
        scheduleTitle: `${def.name} Schedule`,
        markdownContent: [`${def.name} Schedule content.`]
      });
    }
    return schedules;
  }

  private static nta_getPlaceholderSchedules(): Schedule[] {
    return [
      { id: 'sch1', schedule: 'sch1', scheduleNumber: 1, scheduleTitle: 'First Schedule', markdownContent: ['Provisions relating to income tax rates.'] }
    ];
  }

  private static nta_extractTitle(text: string): string {
    const match = text.match(/NIGERIA\s+TAX\s+ACT[,\s]*(\d{4})/i);
    return match ? `Nigeria Tax Act, ${match[1]}` : 'Nigeria Tax Act, 2025';
  }

  private static nta_extractActNumber(text: string): string {
    const match = text.match(/ACT\s+No\.?\s*(\d+)/i);
    return match ? `No. ${match[1]}` : 'No. 7';
  }

  private static nta_extractYear(text: string): number {
    const match = text.match(/20\d{2}/);
    return match ? parseInt(match[0]) : 2025;
  }

  private static nta_extractCommencementDate(text: string): string {
    return '1st January, 2026';
  }

  private static nta_extractDescription(): string {
    return 'An Act to repeal various tax laws and consolidate the legal frameworks relating to taxation in Nigeria, providing for taxation of income, transactions and instruments.';
  }

  // ========================================================================
  // NIGERIA TAX ADMINISTRATION ACT PROCESSOR - FIXED
  // ========================================================================

  private static processNigeriaTaxAdministrationAct(text: string, documentId: string): StructuredDocument {
    console.log('=== NIGERIA TAX ADMINISTRATION ACT - DEDICATED PROCESSOR ===');
    
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[—–]/g, '-')
      .trim();

    // Find the body text after ENACTED line
    const enactedPattern = /ENACTED\s+by\s+the\s+National\s+Assembly\s+of\s+the\s+Federal\s+Republic\s+of\s+Nigeria\s*[—–-]/i;
    const enactedMatch = normalizedText.match(enactedPattern);
    
    let bodyText = normalizedText;
    if (enactedMatch && enactedMatch.index !== undefined) {
      bodyText = normalizedText.substring(enactedMatch.index + enactedMatch[0].length);
      console.log('[NTAA] Found ENACTED line, body text length:', bodyText.length);
    }

    // Find schedule start
    const scheduleStartIndex = bodyText.indexOf('\nSCHEDULES\n');
    let chaptersText = bodyText;
    if (scheduleStartIndex !== -1) {
      chaptersText = bodyText.substring(0, scheduleStartIndex);
    }

    // Extract chapters with FIXED method
    const chapters = this.ntaa_extractChaptersFixed(chaptersText);
    console.log(`[NTAA] Extracted ${chapters.length} chapters`);

    // Extract schedules
    const schedules = this.ntaa_extractSchedules(normalizedText);

    return {
      id: documentId,
      title: 'Nigeria Tax Administration Act, 2025',
      actNumber: 'No. 5',
      year: 2025,
      commencementDate: '1st January, 2025',
      description: 'An Act to provide for the assessment, collection of, and accounting for revenue accruing to the Federation, Federal, States and Local Governments, prescribe the powers and functions of tax authorities; and for related matters.',
      chapters: chapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
      schedules,
      metadata: {
        source: 'Federal Republic of Nigeria Official Gazette',
        publisher: 'Federal Government Printer, Abuja, Nigeria',
        pageRange: 'A1–A150',
        format: 'markdown',
        encoding: 'UTF-8'
      }
    };
  }

  /**
   * FIXED: Extract chapters from NTAA - handles multiple formats
   */
  private static ntaa_extractChaptersFixed(text: string): Chapter[] {
    const chapters: Chapter[] = [];
    if (!text.trim()) return chapters;

    const numberMap: { [key: string]: number } = {
      'ONE': 1, '1': 1,
      'TWO': 2, '2': 2,
      'THREE': 3, '3': 3,
      'FOUR': 4, '4': 4,
      'FIVE': 5, '5': 5
    };

    // APPROACH 1: Find all CHAPTER headers by looking for "CHAPTER" followed by word/number
    const chapterPositions: Array<{ number: number, title: string, index: number }> = [];
    
    // Look for "CHAPTER ONE", "CHAPTER TWO", etc.
    const chapterHeaderRegex = /CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|1|2|3|4|5)\b/gi;
    let match;
    
    while ((match = chapterHeaderRegex.exec(text)) !== null) {
      if (match.index === undefined) continue;
      
      const chapterKey = match[1].toUpperCase();
      const chapterNumber = numberMap[chapterKey] || 1;
      
      // Look ahead up to 300 characters to find the chapter title
      const afterHeader = text.substring(match.index + match[0].length, match.index + match[0].length + 300);
      
      // Try to find title after dash
      let titleMatch = afterHeader.match(/^\s*[—–-]\s*([^\n]+)/);
      let chapterTitle = '';
      
      if (titleMatch) {
        chapterTitle = titleMatch[1].trim().toUpperCase();
      } else {
        // Try to find title from the following PART line
        const partMatch = afterHeader.match(/PART\s+[IVX]+\s*[—–-]\s*([^\n]+)/i);
        if (partMatch) {
          chapterTitle = partMatch[1].trim().toUpperCase();
        } else {
          // Fallback title
          chapterTitle = `CHAPTER ${chapterKey}`;
        }
      }
      
      chapterPositions.push({
        number: chapterNumber,
        title: chapterTitle,
        index: match.index
      });
      
      console.log(`[NTAA] Found CHAPTER ${chapterNumber}: "${chapterTitle}" at index ${match.index}`);
    }

    // Sort by index
    chapterPositions.sort((a, b) => a.index - b.index);
    
    // Remove duplicates by chapter number (keep first occurrence)
    const uniquePositions: Array<{ number: number, title: string, index: number }> = [];
    const seenNumbers = new Set<number>();
    for (const pos of chapterPositions) {
      if (!seenNumbers.has(pos.number)) {
        seenNumbers.add(pos.number);
        uniquePositions.push(pos);
      }
    }
    
    console.log(`[NTAA] Unique chapters found: ${uniquePositions.length}`);

    // Process each chapter
    for (let i = 0; i < uniquePositions.length; i++) {
      const current = uniquePositions[i];
      let endIndex = text.length;
      if (i + 1 < uniquePositions.length) {
        endIndex = uniquePositions[i + 1].index;
      }

      const chapterContent = text.substring(current.index, endIndex);
      const parts = this.ntaa_extractPartsFixed(chapterContent, current.number);
      
      chapters.push({
        id: `ch${current.number}`,
        chapter: `ch${current.number}`,
        chapterNumber: current.number,
        chapterTitle: current.title,
        parts
      });
    }

    return chapters;
  }

  /**
   * FIXED: Extract parts from chapter content
   */
  private static ntaa_extractPartsFixed(content: string, chapterNumber: number): Part[] {
    const parts: Part[] = [];
    if (!content.trim()) return parts;

    const partPattern = /PART\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)\s*[—–-]\s*([^\n]+)/gi;
    const partMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

    const romanMap: { [key: string]: number } = {
      'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10
    };

    let match;
    while ((match = partPattern.exec(content)) !== null) {
      if (match.index === undefined) continue;
      
      const partNumber = romanMap[match[1].toUpperCase()] || 1;
      const partTitle = match[2].trim().toUpperCase();
      
      partMatches.push({
        number: partNumber,
        title: partTitle,
        index: match.index,
        fullMatch: match[0]
      });
      
      console.log(`[NTAA] Chapter ${chapterNumber}: Found PART ${partNumber}: "${partTitle}"`);
    }

    partMatches.sort((a, b) => a.index - b.index);

    if (partMatches.length === 0) {
      const sections = this.ntaa_extractSectionsFixed(content, chapterNumber, 1);
      if (sections.length > 0) {
        parts.push({
          id: `ch${chapterNumber}-pt1`,
          part: `ch${chapterNumber}-pt1`,
          partNumber: 1,
          partTitle: 'PROVISIONS',
          sections
        });
      }
      return parts;
    }

    for (let i = 0; i < partMatches.length; i++) {
      const current = partMatches[i];
      let endIndex = content.length;
      if (i + 1 < partMatches.length) {
        endIndex = partMatches[i + 1].index;
      }

      const partContent = content.substring(current.index + current.fullMatch.length, endIndex);
      const sections = this.ntaa_extractSectionsFixed(partContent, chapterNumber, current.number);
      
      if (sections.length > 0) {
        parts.push({
          id: `ch${chapterNumber}-pt${current.number}`,
          part: `ch${chapterNumber}-pt${current.number}`,
          partNumber: current.number,
          partTitle: current.title,
          sections
        });
      }
    }

    return parts;
  }

  /**
   * FIXED: Extract sections from part content
   */
  private static ntaa_extractSectionsFixed(content: string, chapterNumber: number, partNumber: number): Section[] {
    const sections: Section[] = [];
    if (!content.trim()) return sections;

    let cleanContent = content;
    cleanContent = cleanContent.replace(/^[A-Z]\d+\s*$/gm, '');
    cleanContent = cleanContent.replace(/^\s*\d+\s*$/gm, '');

    const sectionPattern = /(?:^|\n)\s*(\d{1,3})\.\s+([^\n]+)/g;
    const sectionMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

    let match;
    while ((match = sectionPattern.exec(cleanContent)) !== null) {
      if (match.index === undefined) continue;
      
      const sectionNumber = parseInt(match[1]);
      if (sectionNumber > 200) continue;
      
      let sectionTitle = match[2].trim().replace(/\s+/g, ' ');
      
      sectionMatches.push({
        number: sectionNumber,
        title: sectionTitle,
        index: match.index,
        fullMatch: match[0]
      });
    }

    for (let i = 0; i < sectionMatches.length; i++) {
      const current = sectionMatches[i];
      let endIndex = cleanContent.length;
      if (i + 1 < sectionMatches.length) {
        endIndex = sectionMatches[i + 1].index;
      }

      const sectionStart = current.index + current.fullMatch.length;
      const sectionContent = cleanContent.substring(sectionStart, endIndex);
      
      const subsections = this.ntaa_extractSubsectionsFixed(sectionContent, chapterNumber, partNumber, current.number);
      
      const firstSubIndex = sectionContent.search(/\(\s*\d+\s*\)/);
      
      if (firstSubIndex === -1) {
        const cleaned = this.ntaa_cleanTextFixed(sectionContent);
        sections.push({
          id: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
          section: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
          sectionNumber: current.number,
          sectionTitle: current.title,
          markdownContent: cleaned ? [cleaned] : []
        });
      } else if (firstSubIndex > 0) {
        const mainContent = sectionContent.substring(0, firstSubIndex).trim();
        const cleanedMain = this.ntaa_cleanTextFixed(mainContent);
        
        sections.push({
          id: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
          section: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
          sectionNumber: current.number,
          sectionTitle: current.title,
          markdownContent: cleanedMain ? [cleanedMain] : []
        });
        
        sections.push(...subsections);
      } else {
        sections.push(...subsections);
      }
    }

    return sections;
  }

  /**
   * FIXED: Extract subsections
   */
  private static ntaa_extractSubsectionsFixed(content: string, chapterNumber: number, partNumber: number, sectionNumber: number): Section[] {
    const subsections: Section[] = [];
    if (!content.trim()) return subsections;

    const subPattern = /\(\s*(\d+)\s*\)/g;
    const subMatches: Array<{ number: string, index: number, fullMatch: string }> = [];

    let match;
    while ((match = subPattern.exec(content)) !== null) {
      if (match.index === undefined) continue;
      subMatches.push({ number: match[1], index: match.index, fullMatch: match[0] });
    }

    for (let i = 0; i < subMatches.length; i++) {
      const current = subMatches[i];
      let endIndex = content.length;
      if (i + 1 < subMatches.length) {
        endIndex = subMatches[i + 1].index;
      }

      const afterSub = content.substring(current.index);
      const nextNewline = afterSub.indexOf('\n');
      const nextOpenParen = afterSub.indexOf('(');
      
      let titleEnd = afterSub.length;
      if (nextNewline !== -1) titleEnd = Math.min(titleEnd, nextNewline);
      if (nextOpenParen !== -1) titleEnd = Math.min(titleEnd, nextOpenParen);
      
      let title = afterSub.substring(0, titleEnd).trim();
      title = title.replace(/\s*[—–-]\s*$/, '').replace(/\s+/g, ' ');

      let contentStart = current.index;
      if (nextNewline !== -1) {
        contentStart = current.index + current.fullMatch.length + nextNewline + 1;
      } else {
        contentStart = current.index + current.fullMatch.length + title.length;
      }

      let subContent = content.substring(contentStart, endIndex).trim();
      subContent = this.ntaa_cleanTextFixed(subContent);

      const fullTitle = `(${current.number})${title ? ' ' + title : ''}`;

      subsections.push({
        id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${i + 1}`,
        section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${i + 1}`,
        sectionNumber,
        sectionTitle: fullTitle,
        markdownContent: subContent ? [subContent] : []
      });
    }

    return subsections;
  }

  /**
   * FIXED: Clean text
   */
  private static ntaa_cleanTextFixed(text: string): string {
    if (!text) return '';
    
    let cleaned = text;
    cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    cleaned = cleaned.replace(/([a-zA-Z])-\s*\n\s*([a-zA-Z])/g, '$1$2');
    cleaned = cleaned.replace(/\(\s*([a-z])\s*\)/g, '($1)');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/\s+\)/g, ')');
    cleaned = cleaned.replace(/\(\s+/g, '(');
    cleaned = cleaned.replace(/\s*,\s*/g, ', ');
    cleaned = cleaned.replace(/\s*;\s*/g, '; ');
    cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    cleaned = cleaned.replace(/^\s+/, '');
    
    return cleaned.trim();
  }

  private static ntaa_extractSchedules(text: string): Schedule[] {
    const schedules: Schedule[] = [];
    
    let firstScheduleIndex = text.indexOf('FIRST SCHEDULE');
    if (firstScheduleIndex === -1) {
      firstScheduleIndex = text.indexOf('\nSCHEDULES\n');
    }
    
    if (firstScheduleIndex === -1) {
      return schedules;
    }

    const schedulesText = text.substring(firstScheduleIndex);
    
    const scheduleDefs = [
      { name: 'First', number: 1, pattern: /FIRST\s+SCHEDULE/i }
    ];

    const positions: Array<{ name: string; number: number; index: number }> = [];

    for (const def of scheduleDefs) {
      const match = schedulesText.match(def.pattern);
      if (match && match.index !== undefined) {
        positions.push({ name: def.name, number: def.number, index: match.index });
      }
    }

    for (let i = 0; i < positions.length; i++) {
      const current = positions[i];
      let endIndex = schedulesText.length;
      if (i + 1 < positions.length) {
        endIndex = positions[i + 1].index;
      }

      let content = schedulesText.substring(current.index, endIndex);
      content = content.replace(new RegExp(`^${current.name}\\s+SCHEDULE[^\\n]*\\n?`, 'i'), '');
      content = content.replace(/^Section\s+\d+\s*\([^)]+\).*?\n/i, '');
      content = content.replace(/^[A-Z]\d+\s*$/gm, '');
      content = content.replace(/^\s*\d+\s*$/gm, '');
      content = content.replace(/\n{3,}/g, '\n\n');
      content = content.replace(/ {2,}/g, ' ');

      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const cleanedContent = lines.join('\n').trim();

      schedules.push({
        id: `sch${current.number}`,
        schedule: `sch${current.number}`,
        scheduleNumber: current.number,
        scheduleTitle: `${current.name} Schedule`,
        markdownContent: cleanedContent ? [cleanedContent] : ['First Schedule content.']
      });
    }

    return schedules;
  }

  // ========================================================================
  // NIGERIA REVENUE SERVICE PROCESSOR - UNCHANGED
  // ========================================================================

  private static processNigeriaRevenueService(text: string, documentId: string): StructuredDocument {
    console.log('=== NIGERIA REVENUE SERVICE - BODY TEXT EXTRACTION ===');
    
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[—–]/g, '-')
      .trim();

    const enactedPattern = /ENACTED\s+by\s+the\s+National\s+Assembly\s+of\s+the\s+Federal\s+Republic\s+of\s+Nigeria\s*[—–-]\s*/i;
    const enactedMatch = normalizedText.match(enactedPattern);
    
    let bodyText = normalizedText;
    
    if (enactedMatch && enactedMatch.index !== undefined) {
      bodyText = normalizedText.substring(enactedMatch.index + enactedMatch[0].length);
      console.log('[NRS] Found ENACTED line, starting body text after it');
    } else {
      const partOneInBody = normalizedText.match(/PART\s+I\s*[—–-]\s*OBJECTIVE\s+AND\s+APPLICATION\s*\n\s*1\./i);
      if (partOneInBody && partOneInBody.index !== undefined) {
        bodyText = normalizedText.substring(partOneInBody.index);
        console.log('[NRS] Found PART I with section 1 in body at index:', partOneInBody.index);
      }
    }

    console.log('[NRS] Body text starts with:', bodyText.substring(0, 300));

    let scheduleStartIndex = bodyText.indexOf('\nSCHEDULES\n');
    if (scheduleStartIndex === -1) {
      scheduleStartIndex = bodyText.indexOf('FIRST SCHEDULE');
    }
    
    let partsText = bodyText;
    if (scheduleStartIndex !== -1) {
      partsText = bodyText.substring(0, scheduleStartIndex);
      console.log(`[NRS] Cut parts at schedule start (index ${scheduleStartIndex})`);
    }

    const parts = this.nrs_extractPartsFromBody(partsText);
    console.log(`[NRS] Extracted ${parts.length} parts from body`);

    const schedules = this.nrs_extractSchedulesFromBody(normalizedText);
    console.log(`[NRS] Extracted ${schedules.length} schedules`);

    const title = this.nrs_extractTitle(text);
    const actNumber = this.nrs_extractActNumber(text);
    const year = this.nrs_extractYear(text);
    const commencementDate = this.nrs_extractCommencementDate(text);
    const description = this.nrs_extractDescription(text);

    return {
      id: documentId,
      title,
      actNumber,
      year,
      commencementDate,
      description,
      chapters: [],
      parts,
      schedules,
      metadata: {
        source: 'Federal Republic of Nigeria Official Gazette',
        publisher: 'Federal Government Printer, Lagos, Nigeria',
        pageRange: 'A231–A257',
        format: 'markdown',
        encoding: 'UTF-8'
      }
    };
  }

  private static nrs_extractPartsFromBody(text: string): Part[] {
    const parts: Part[] = [];
    if (!text.trim()) return parts;

    const partPattern = /PART\s+(I|II|III|IV|V|VI|VII)\s*[—–-]\s*([^\n]+)/gi;
    const partMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

    const romanMap: { [key: string]: number } = {
      'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7
    };

    let match;
    while ((match = partPattern.exec(text)) !== null) {
      if (match.index === undefined) continue;
      
      const partNumber = romanMap[match[1].toUpperCase()] || 1;
      let partTitle = match[2].trim().toUpperCase();
      
      if (partNumber === 3 && partTitle === 'ESTABLISHMENT AND COMPOSITION OF THE GOVERNING') {
        const afterMatch = text.substring(match.index + match[0].length, match.index + match[0].length + 50);
        const boardMatch = afterMatch.match(/^\s*BOARD\s+OF\s+THE\s+SERVICE/i);
        if (boardMatch) {
          partTitle = partTitle + ' ' + boardMatch[0].trim();
        }
      }

      partMatches.push({ 
        number: partNumber, 
        title: partTitle, 
        index: match.index, 
        fullMatch: match[0] 
      });
      
      console.log(`[NRS] Found PART ${partNumber}: "${partTitle}" at index ${match.index}`);
    }

    partMatches.sort((a, b) => a.index - b.index);

    for (let i = 0; i < partMatches.length; i++) {
      const current = partMatches[i];
      let endIndex = text.length;
      if (i + 1 < partMatches.length) {
        endIndex = partMatches[i + 1].index;
      }

      const partContent = text.substring(current.index + current.fullMatch.length, endIndex);
      const sections = this.nrs_extractSectionsFromBody(partContent, current.number);
      
      if (sections.length > 0) {
        parts.push({
          id: `pt${current.number}`,
          part: `pt${current.number}`,
          partNumber: current.number,
          partTitle: current.title,
          sections
        });
      }
    }

    const uniqueParts: Part[] = [];
    const seen = new Set<number>();
    for (const part of parts) {
      if (!seen.has(part.partNumber)) {
        seen.add(part.partNumber);
        uniqueParts.push(part);
      }
    }
    
    return uniqueParts.sort((a, b) => a.partNumber - b.partNumber);
  }

  private static nrs_extractSectionsFromBody(content: string, partNumber: number): Section[] {
    const sections: Section[] = [];
    if (!content.trim()) return sections;

    let cleanContent = content;
    
    cleanContent = cleanContent.replace(/^[A-Z]\d+\s*$/gm, '');
    cleanContent = cleanContent.replace(/^\s*\d+\s*$/gm, '');

    const sectionPattern = /(?:^|\n)\s*(\d{1,3})\.\s+([^\n]+)/g;
    const sectionMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

    let match;
    while ((match = sectionPattern.exec(cleanContent)) !== null) {
      if (match.index === undefined) continue;
      
      const sectionNumber = parseInt(match[1]);
      if (sectionNumber > 200) continue;
      
      let sectionTitle = match[2].trim().replace(/\s+/g, ' ');
      
      sectionMatches.push({ 
        number: sectionNumber, 
        title: sectionTitle, 
        index: match.index, 
        fullMatch: match[0] 
      });
    }

    console.log(`[NRS] Part ${partNumber}: Found ${sectionMatches.length} sections in body`);

    for (let i = 0; i < sectionMatches.length; i++) {
      const current = sectionMatches[i];
      let endIndex = cleanContent.length;
      if (i + 1 < sectionMatches.length) {
        endIndex = sectionMatches[i + 1].index;
      }

      const sectionStart = current.index + current.fullMatch.length;
      const sectionContent = cleanContent.substring(sectionStart, endIndex);
      
      const subsections = this.nrs_extractSubsectionsFromBody(sectionContent, partNumber, current.number);
      
      const firstSubIndex = sectionContent.search(/\(\s*\d+\s*\)/);
      
      if (firstSubIndex === -1) {
        const cleaned = this.nrs_cleanBodyText(sectionContent);
        sections.push({
          id: `pt${partNumber}-s${current.number}`,
          section: `pt${partNumber}-s${current.number}`,
          sectionNumber: current.number,
          sectionTitle: current.title,
          markdownContent: cleaned ? [cleaned] : []
        });
      } else if (firstSubIndex > 0) {
        const mainContent = sectionContent.substring(0, firstSubIndex).trim();
        const cleanedMain = this.nrs_cleanBodyText(mainContent);
        
        sections.push({
          id: `pt${partNumber}-s${current.number}`,
          section: `pt${partNumber}-s${current.number}`,
          sectionNumber: current.number,
          sectionTitle: current.title,
          markdownContent: cleanedMain ? [cleanedMain] : []
        });
        
        sections.push(...subsections);
      } else {
        sections.push(...subsections);
      }
    }

    const uniqueSections: Section[] = [];
    const seenIds = new Set<string>();
    for (const section of sections) {
      if (!seenIds.has(section.id)) {
        seenIds.add(section.id);
        uniqueSections.push(section);
      }
    }
    
    return uniqueSections;
  }

  private static nrs_extractSubsectionsFromBody(content: string, partNumber: number, sectionNumber: number): Section[] {
    const subsections: Section[] = [];
    if (!content.trim()) return subsections;

    const subPattern = /\(\s*(\d+)\s*\)/g;
    const subMatches: Array<{ number: string, index: number, fullMatch: string }> = [];

    let match;
    while ((match = subPattern.exec(content)) !== null) {
      if (match.index === undefined) continue;
      subMatches.push({ number: match[1], index: match.index, fullMatch: match[0] });
    }

    for (let i = 0; i < subMatches.length; i++) {
      const current = subMatches[i];
      let endIndex = content.length;
      if (i + 1 < subMatches.length) {
        endIndex = subMatches[i + 1].index;
      }

      const afterSub = content.substring(current.index + current.fullMatch.length);
      const nextNewline = afterSub.indexOf('\n');
      const nextOpenParen = afterSub.indexOf('(');
      
      let titleEnd = afterSub.length;
      if (nextNewline !== -1) titleEnd = Math.min(titleEnd, nextNewline);
      if (nextOpenParen !== -1) titleEnd = Math.min(titleEnd, nextOpenParen);
      
      let title = afterSub.substring(0, titleEnd).trim();
      title = title.replace(/\s*[—–-]\s*$/, '').replace(/\s+/g, ' ');

      let contentStart = current.index;
      if (nextNewline !== -1) {
        contentStart = current.index + current.fullMatch.length + nextNewline + 1;
      } else {
        contentStart = current.index + current.fullMatch.length + title.length;
      }

      let subContent = content.substring(contentStart, endIndex).trim();
      subContent = this.nrs_cleanBodyText(subContent);

      const fullTitle = `(${current.number})${title ? ' ' + title : ''}`;

      subsections.push({
        id: `pt${partNumber}-s${sectionNumber}-us${i + 1}`,
        section: `pt${partNumber}-s${sectionNumber}-us${i + 1}`,
        sectionNumber,
        sectionTitle: fullTitle,
        markdownContent: subContent ? [subContent] : []
      });
    }

    return subsections;
  }

  private static nrs_cleanBodyText(text: string): string {
    if (!text) return '';
    
    let cleaned = text;
    
    cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    
    const headersToRemove = [
      'Objective', 'Application', 'Functions of the Service', 
      'Powers of the Board', 'Establishment of the', 'Commencement',
      'Establishment', 'Fund of the Service', 'Expenditure of the Service',
      'Estimates', 'Accounts and audit', 'Annual report', 'Pension',
      'Staff regulations', 'Citation'
    ];
    
    for (const header of headersToRemove) {
      const pattern = new RegExp(`^\\s*${header}\\s*$`, 'gim');
      cleaned = cleaned.replace(pattern, '');
    }
    
    cleaned = cleaned.replace(/([a-zA-Z])-\s*\n\s*([a-zA-Z])/g, '$1$2');
    cleaned = cleaned.replace(/\(\s*([a-z])\s*\)/g, '($1)');
    cleaned = cleaned.replace(/\(\s*([ivx]+)\s*\)/gi, '($1)');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/\s+\)/g, ')');
    cleaned = cleaned.replace(/\(\s+/g, '(');
    cleaned = cleaned.replace(/\s*,\s*/g, ', ');
    cleaned = cleaned.replace(/\s*;\s*/g, '; ');
    cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    cleaned = cleaned.replace(/^\s+/, '');
    
    return cleaned.trim();
  }

  private static nrs_extractSchedulesFromBody(text: string): Schedule[] {
    const schedules: Schedule[] = [];
    
    let firstScheduleIndex = text.indexOf('FIRST SCHEDULE');
    if (firstScheduleIndex === -1) {
      firstScheduleIndex = text.indexOf('\nSCHEDULES\n');
    }
    
    if (firstScheduleIndex === -1) {
      console.log('[NRS] No schedules found');
      return this.nrs_getPlaceholderSchedules();
    }

    const schedulesText = text.substring(firstScheduleIndex);

    const scheduleDefs = [
      { name: 'First', number: 1, pattern: /FIRST\s+SCHEDULE/i },
      { name: 'Second', number: 2, pattern: /SECOND\s+SCHEDULE/i },
      { name: 'Third', number: 3, pattern: /THIRD\s+SCHEDULE/i }
    ];

    const positions: Array<{ name: string; number: number; index: number }> = [];

    for (const def of scheduleDefs) {
      const match = schedulesText.match(def.pattern);
      if (match && match.index !== undefined) {
        positions.push({ name: def.name, number: def.number, index: match.index });
      }
    }

    positions.sort((a, b) => a.index - b.index);

    for (let i = 0; i < positions.length; i++) {
      const current = positions[i];
      
      let endIndex = schedulesText.length;
      if (i + 1 < positions.length) {
        endIndex = positions[i + 1].index;
      }

      let content = schedulesText.substring(current.index, endIndex);
      
      content = content.replace(new RegExp(`^${current.name}\\s+SCHEDULE[^\\n]*\\n?`, 'i'), '');
      content = content.replace(/^Section\s+\d+\s*\([^)]+\).*?\n/i, '');
      content = content.replace(/^SUPPLEMENTARY\s+PROVISIONS[^\n]*\n/i, '');
      content = content.replace(/^LEGISLATIONS\s+ADMINISTERED[^\n]*\n/i, '');
      content = content.replace(/^Form\s+of\s+Warrant[^\n]*\n/i, '');

      content = content.replace(/^[A-Z]\d+\s*$/gm, '');
      content = content.replace(/^\s*\d+\s*$/gm, '');
      content = content.replace(/\n{3,}/g, '\n\n');
      content = content.replace(/ {2,}/g, ' ');

      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && 
                     !l.includes('SCHEDULE') && 
                     !l.includes('Section') &&
                     !l.includes('SUPPLEMENTARY'));

      const cleanedContent = lines.join('\n').trim();

      const descriptions: { [key: number]: string } = {
        1: 'Supplementary provisions relating to the Board.',
        2: 'Legislations administered by the Service.',
        3: 'Form of Warrant of Deduction at Source.'
      };

      schedules.push({
        id: `sch${current.number}`,
        schedule: `sch${current.number}`,
        scheduleNumber: current.number,
        scheduleTitle: `${current.name} Schedule`,
        markdownContent: cleanedContent ? [cleanedContent] : [descriptions[current.number]]
      });
    }

    return schedules.length > 0 ? schedules : this.nrs_getPlaceholderSchedules();
  }

  private static nrs_getPlaceholderSchedules(): Schedule[] {
    return [
      { id: 'sch1', schedule: 'sch1', scheduleNumber: 1, scheduleTitle: 'First Schedule', markdownContent: ['Supplementary provisions relating to the Board.'] },
      { id: 'sch2', schedule: 'sch2', scheduleNumber: 2, scheduleTitle: 'Second Schedule', markdownContent: ['Legislations administered by the Service.'] },
      { id: 'sch3', schedule: 'sch3', scheduleNumber: 3, scheduleTitle: 'Third Schedule', markdownContent: ['Form of Warrant of Deduction at Source.'] }
    ];
  }

  private static nrs_extractTitle(text: string): string {
    const match = text.match(/NIGERIA\s+REVENUE\s+SERVICE\s*\(ESTABLISHMENT\)\s+ACT[,\s]*(\d{4})/i);
    return match ? `Nigeria Revenue Service (Establishment) Act, ${match[1]}` : 'Nigeria Revenue Service (Establishment) Act, 2025';
  }

  private static nrs_extractActNumber(text: string): string {
    const match = text.match(/ACT\s+NO\.?\s*(\d+)/i);
    return match ? `No. ${match[1]}` : 'No. 4';
  }

  private static nrs_extractYear(text: string): number {
    const match = text.match(/20\d{2}/);
    return match ? parseInt(match[0]) : 2025;
  }

  private static nrs_extractCommencementDate(text: string): string {
    const match = text.match(/\[\s*(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s*,?\s*\d{4})\s*\]/i);
    return match ? match[1] : '26th June, 2025';
  }

  private static nrs_extractDescription(text: string): string {
    const match = text.match(/AN\s+ACT\s+TO\s+REPEAL\s+THE\s+FEDERAL\s+INLAND\s+REVENUE\s+SERVICE[^;]+;/i);
    return match ? match[0].trim() : 'An Act to repeal the Federal Inland Revenue Service (Establishment) Act and enact the Nigeria Revenue Service (Establishment) Act, 2025.';
  }

  // ========================================================================
  // JOINT REVENUE BOARD PROCESSOR - UNCHANGED
  // ========================================================================

  private static processJointRevenueBoard(text: string, documentId: string): StructuredDocument {
    console.log('=== JOINT REVENUE BOARD - DEDICATED PROCESSOR ===');
    
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[—–]/g, '-')
      .trim();

    const bodyStartMatch = normalizedText.match(/ENACTED\s+by\s+the\s+National\s+Assembly[^\n]*\n/i);
    let bodyText = normalizedText;
    if (bodyStartMatch && bodyStartMatch.index !== undefined) {
      const afterEnacted = normalizedText.substring(bodyStartMatch.index);
      const firstNewline = afterEnacted.indexOf('\n');
      if (firstNewline !== -1) bodyText = afterEnacted.substring(firstNewline + 1);
    }

    const scheduleStartIndex = bodyText.indexOf('FIRST SCHEDULE');
    let partsText = bodyText;
    if (scheduleStartIndex !== -1) partsText = bodyText.substring(0, scheduleStartIndex);

    const parts = this.jrb_extractParts(partsText);
    const schedules = this.jrb_extractSchedules(normalizedText);

    const title = this.jrb_extractTitle(normalizedText);
    const actNumber = this.jrb_extractActNumber(normalizedText);
    const year = this.jrb_extractYear(normalizedText);
    const description = this.jrb_extractDescription(normalizedText);

    return {
      id: documentId,
      title,
      actNumber,
      year,
      commencementDate: '2025-01-01',
      description,
      chapters: [],
      parts,
      schedules,
      metadata: {
        source: 'Federal Republic of Nigeria Official Gazette',
        publisher: 'Federal Government Printer, Abuja, Nigeria',
        pageRange: 'A1–A50',
        format: 'markdown',
        encoding: 'UTF-8'
      }
    };
  }

  private static jrb_extractParts(text: string): Part[] {
    const parts: Part[] = [];
    if (!text.trim()) return parts;

    const partPattern = /PART\s+(I|II|III|IV|V|VI|VII)\s*[—–-]\s*([^\n]+)/gi;
    const partMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

    let match;
    const romanMap: { [key: string]: number } = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7 };
    
    while ((match = partPattern.exec(text)) !== null) {
      if (match.index === undefined) continue;
      const partNumber = romanMap[match[1].toUpperCase()] || 1;
      const partTitle = match[2].trim().toUpperCase();
      partMatches.push({ number: partNumber, title: partTitle, index: match.index, fullMatch: match[0] });
    }

    partMatches.sort((a, b) => a.index - b.index);

    for (let i = 0; i < partMatches.length; i++) {
      const current = partMatches[i];
      let endIndex = text.length;
      if (i + 1 < partMatches.length) endIndex = partMatches[i + 1].index;

      const partContent = text.substring(current.index + current.fullMatch.length, endIndex);
      const sections = this.jrb_extractSections(partContent, current.number);
      
      if (sections.length > 0) {
        parts.push({
          id: `pt${current.number}`,
          part: `pt${current.number}`,
          partNumber: current.number,
          partTitle: current.title,
          sections
        });
      }
    }

    const uniqueParts: Part[] = [];
    const seen = new Set<number>();
    for (const part of parts) {
      if (!seen.has(part.partNumber)) {
        seen.add(part.partNumber);
        uniqueParts.push(part);
      }
    }
    return uniqueParts.sort((a, b) => a.partNumber - b.partNumber);
  }

  private static jrb_extractSections(content: string, partNumber: number): Section[] {
    const sections: Section[] = [];
    if (!content.trim()) return sections;

    const cleanContent = content.replace(/^[A-Z]\d+\s*$/gm, '').replace(/^\s*\d+\s*$/gm, '');
    const sectionPattern = /(?:^|\n)\s*(\d{1,3})\.\s+([^\n]+)/g;
    const sectionMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

    let match;
    while ((match = sectionPattern.exec(cleanContent)) !== null) {
      if (match.index === undefined) continue;
      const sectionNumber = parseInt(match[1]);
      if (sectionNumber > 200) continue;
      const sectionTitle = match[2].trim().replace(/\s+/g, ' ');
      sectionMatches.push({ number: sectionNumber, title: sectionTitle, index: match.index, fullMatch: match[0] });
    }

    for (let i = 0; i < sectionMatches.length; i++) {
      const current = sectionMatches[i];
      let endIndex = cleanContent.length;
      if (i + 1 < sectionMatches.length) endIndex = sectionMatches[i + 1].index;

      const sectionContent = cleanContent.substring(current.index + current.fullMatch.length, endIndex);
      const trimmedContent = sectionContent.trim();

      if (/^\s*\(\d+\)/.test(trimmedContent)) {
        const subsections = this.jrb_extractSubsections(sectionContent, partNumber, current.number);
        sections.push(...subsections);
      } else {
        const mainSection: Section = {
          id: `pt${partNumber}-s${current.number}`,
          section: `pt${partNumber}-s${current.number}`,
          sectionNumber: current.number,
          sectionTitle: current.title,
          markdownContent: []
        };

        const firstSubIndex = sectionContent.search(/\(\d+\)/);
        if (firstSubIndex !== -1) {
          const mainContent = sectionContent.substring(0, firstSubIndex).trim();
          if (mainContent) mainSection.markdownContent = [this.jrb_cleanText(mainContent)];
          
          const subsections = this.jrb_extractSubsections(sectionContent.substring(firstSubIndex), partNumber, current.number);
          sections.push(mainSection);
          sections.push(...subsections);
        } else {
          const cleaned = this.jrb_cleanText(sectionContent);
          if (cleaned) mainSection.markdownContent = [cleaned];
          sections.push(mainSection);
        }
      }
    }

    const uniqueSections: Section[] = [];
    const seenIds = new Set<string>();
    for (const section of sections) {
      if (!seenIds.has(section.id)) {
        seenIds.add(section.id);
        uniqueSections.push(section);
      }
    }
    return uniqueSections;
  }

  private static jrb_extractSubsections(content: string, partNumber: number, sectionNumber: number): Section[] {
    const subsections: Section[] = [];
    if (!content.trim()) return subsections;

    const subPattern = /\(\s*(\d+)\s*\)\s*([^\n(]*)/g;
    const subMatches: Array<{ number: string, title: string, index: number, fullMatch: string }> = [];

    let match;
    while ((match = subPattern.exec(content)) !== null) {
      if (match.index === undefined) continue;
      let title = match[2].trim().replace(/\s*[—–-]\s*$/, '');
      subMatches.push({ number: match[1], title, index: match.index, fullMatch: match[0] });
    }

    for (let i = 0; i < subMatches.length; i++) {
      const current = subMatches[i];
      let endIndex = content.length;
      if (i + 1 < subMatches.length) endIndex = subMatches[i + 1].index;

      const afterTitle = content.substring(current.index);
      const firstNewline = afterTitle.indexOf('\n');
      let contentStart = current.index;
      if (firstNewline !== -1) {
        contentStart = current.index + firstNewline + 1;
      } else {
        contentStart = current.index + current.fullMatch.length;
      }

      let subContent = content.substring(contentStart, endIndex).trim();
      subContent = this.jrb_cleanText(subContent);

      subsections.push({
        id: `pt${partNumber}-s${sectionNumber}-us${i + 1}`,
        section: `pt${partNumber}-s${sectionNumber}-us${i + 1}`,
        sectionNumber,
        sectionTitle: `(${current.number})${current.title ? ' ' + current.title : ''}`,
        markdownContent: subContent ? [subContent] : []
      });
    }
    return subsections;
  }

  private static jrb_cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/^[A-Z]\d+\s*$/gm, '').replace(/^\s*\d+\s*$/gm, '')
      .replace(/^(?:Objectives|Application|Composition|Board|Functions|Powers|Establishment)\s*$/gim, '')
      .replace(/([a-zA-Z])-\s*\n\s*([a-zA-Z])/g, '$1$2')
      .replace(/\(\s*([a-z])\s*\)/g, '($1)')
      .replace(/\(\s*([ivx]+)\s*\)/gi, '($1)')
      .replace(/\n{3,}/g, '\n\n').replace(/\s+/g, ' ').trim();
  }

  private static jrb_extractSchedules(text: string): Schedule[] {
    return [
      { id: 'sch1', schedule: 'sch1', scheduleNumber: 1, scheduleTitle: 'First Schedule', markdownContent: ['Supplementary provisions relating to the proceedings of the Board.'] },
      { id: 'sch2', schedule: 'sch2', scheduleNumber: 2, scheduleTitle: 'Second Schedule', markdownContent: ['Procedure of the Tax Appeal Tribunal.'] },
      { id: 'sch3', schedule: 'sch3', scheduleNumber: 3, scheduleTitle: 'Third Schedule', markdownContent: ['Procedure of the Office of the Tax Ombud.'] }
    ];
  }

  private static jrb_extractTitle(text: string): string {
    const match = text.match(/JOINT\s+REVENUE\s+BOARD\s+(?:OF\s+NIGERIA\s*)?\(ESTABLISHMENT\)\s+ACT[,\s]*(\d{4})/i);
    return match ? `Joint Revenue Board (Establishment) Act, ${match[1]}` : 'Joint Revenue Board (Establishment) Act, 2025';
  }

  private static jrb_extractActNumber(text: string): string {
    const match = text.match(/ACT\s+NO\.?\s*(\d+)/i);
    return match ? `No. ${match[1]}` : 'No. 3';
  }

  private static jrb_extractYear(text: string): number {
    const match = text.match(/20\d{2}/);
    return match ? parseInt(match[0]) : 2025;
  }

  private static jrb_extractDescription(text: string): string {
    const match = text.match(/An\s+Act\s+to\s+establish\s+the\s+Joint\s+Revenue\s+Board[^;\.]+[;\.]/i);
    return match ? match[0].trim() : 'An Act to establish the Joint Revenue Board, the Tax Appeal Tribunal and the Office of the Tax Ombud.';
  }

  // ========================================================================
  // PETROLEUM INDUSTRY ACT PROCESSOR - UNCHANGED
  // ========================================================================

  private static processPetroleumIndustryAct(text: string, documentId: string): StructuredDocument {
    console.log('=== PETROLEUM INDUSTRY ACT - DEDICATED PROCESSOR ===');
    
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[—–]/g, '-')
      .trim();

    const contentStartIndex = this.pia_findContentStart(normalizedText);
    let contentText = normalizedText;
    if (contentStartIndex !== -1) {
      contentText = normalizedText.substring(contentStartIndex);
    }

    const chapters = this.pia_parseChapters(contentText);
    const schedules = this.pia_extractSchedules(normalizedText);

    const title = this.pia_extractTitle(normalizedText);
    const actNumber = this.pia_extractActNumber(normalizedText);
    const year = this.pia_extractYear(normalizedText);
    const commencementDate = this.pia_extractCommencementDate(normalizedText);
    const description = this.pia_extractDescription();

    return {
      id: documentId,
      title,
      actNumber,
      year,
      commencementDate,
      description,
      chapters: chapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
      schedules,
      metadata: {
        source: 'Federal Republic of Nigeria Official Gazette',
        publisher: 'Federal Government Printer, Lagos, Nigeria',
        pageRange: 'A121–A370',
        format: 'markdown',
        encoding: 'UTF-8'
      }
    };
  }

  private static pia_findContentStart(text: string): number {
    const patterns = [
      /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS/i,
      /PETROLEUM\s+INDUSTRY\s+ACT,\s*2021[\s\S]*?CHAPTER\s+1/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) return match.index;
    }
    return -1;
  }

  private static pia_parseChapters(text: string): Chapter[] {
    const chapters: Chapter[] = [];
    const chapterRegex = /CHAPTER\s+(\d+)[—\-]\s*([^\n]+)/gi;
    const chapterMatches: Array<{ number: number, title: string, index: number }> = [];

    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
      if (match.index === undefined) continue;
      chapterMatches.push({
        number: parseInt(match[1]),
        title: match[2].toUpperCase().trim(),
        index: match.index
      });
    }

    for (let i = 0; i < chapterMatches.length; i++) {
      const current = chapterMatches[i];
      let endIndex = text.length;
      if (i + 1 < chapterMatches.length) endIndex = chapterMatches[i + 1].index;
      else {
        const scheduleStart = text.indexOf('FIRST SCHEDULE', current.index);
        if (scheduleStart !== -1) endIndex = scheduleStart;
      }

      const chapterContent = text.substring(current.index, endIndex);
      const parts = this.pia_extractParts(chapterContent, current.number);

      chapters.push({
        id: `ch${current.number}`,
        chapter: `ch${current.number}`,
        chapterNumber: current.number,
        chapterTitle: current.title,
        parts
      });
    }

    return chapters;
  }

  private static pia_extractParts(content: string, chapterNumber: number): Part[] {
    const parts: Part[] = [];
    const partRegex = /PART\s+([IVXLCDM]+)[—\-]\s*([^\n]+)/gi;
    const partMatches: Array<{ number: string, title: string, index: number }> = [];

    let match;
    while ((match = partRegex.exec(content)) !== null) {
      if (match.index === undefined) continue;
      partMatches.push({ number: match[1], title: match[2].toUpperCase().trim(), index: match.index });
    }

    if (partMatches.length === 0) {
      parts.push({
        id: `ch${chapterNumber}-pt1`,
        part: `ch${chapterNumber}-pt1`,
        partNumber: 1,
        partTitle: 'PROVISIONS',
        sections: this.pia_extractSections(content, chapterNumber, 1)
      });
      return parts;
    }

    for (let i = 0; i < partMatches.length; i++) {
      const current = partMatches[i];
      const nextIndex = i + 1 < partMatches.length ? partMatches[i + 1].index : content.length;
      const partContent = content.substring(current.index, nextIndex);
      
      parts.push({
        id: `ch${chapterNumber}-pt${i + 1}`,
        part: `ch${chapterNumber}-pt${i + 1}`,
        partNumber: i + 1,
        partTitle: current.title,
        sections: this.pia_extractSections(partContent, chapterNumber, i + 1)
      });
    }
    return parts;
  }

  private static pia_extractSections(content: string, chapterNumber: number, partNumber: number): Section[] {
    const sections: Section[] = [];
    const sectionRegex = /(?:^|\n)(\d{1,3})\.\s*([^\n]+)/g;
    const matches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      if (match.index === undefined) continue;
      matches.push({
        number: parseInt(match[1]),
        title: match[2].trim(),
        index: match.index,
        fullMatch: match[0]
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
      const sectionContent = content.substring(current.index + current.fullMatch.length, nextIndex);

      sections.push({
        id: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
        section: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
        sectionNumber: current.number,
        sectionTitle: current.title,
        markdownContent: sectionContent.trim() ? [sectionContent.trim()] : []
      });
    }
    return sections;
  }

  private static pia_extractSchedules(text: string): Schedule[] {
    return [
      { id: 'sch1', schedule: 'sch1', scheduleNumber: 1, scheduleTitle: 'First Schedule', markdownContent: ['First Schedule content.'] },
      { id: 'sch2', schedule: 'sch2', scheduleNumber: 2, scheduleTitle: 'Second Schedule', markdownContent: ['Second Schedule content.'] },
      { id: 'sch3', schedule: 'sch3', scheduleNumber: 3, scheduleTitle: 'Third Schedule', markdownContent: ['Third Schedule content.'] },
      { id: 'sch4', schedule: 'sch4', scheduleNumber: 4, scheduleTitle: 'Fourth Schedule', markdownContent: ['Fourth Schedule content.'] },
      { id: 'sch5', schedule: 'sch5', scheduleNumber: 5, scheduleTitle: 'Fifth Schedule', markdownContent: ['Fifth Schedule content.'] }
    ];
  }

  private static pia_extractTitle(text: string): string {
    const match = text.match(/PETROLEUM\s+INDUSTRY\s+ACT[,\s]*(\d{4})/i);
    return match ? `Petroleum Industry Act, ${match[1]}` : 'Petroleum Industry Act, 2021';
  }

  private static pia_extractActNumber(text: string): string {
    const match = text.match(/ACT\s+No\.?\s*(\d+)/i);
    return match ? `No. ${match[1]}` : 'No. 6';
  }

  private static pia_extractYear(text: string): number {
    const match = text.match(/20\d{2}/);
    return match ? parseInt(match[0]) : 2021;
  }

  private static pia_extractCommencementDate(text: string): string {
    return '16th August, 2021';
  }

  private static pia_extractDescription(): string {
    return 'An Act to provide legal, governance, regulatory and fiscal framework for the Nigerian petroleum industry and host communities.';
  }

  // ========================================================================
  // PUBLIC HELPER METHODS
  // ========================================================================

  static generateTableOfContents(structuredDoc: StructuredDocument): any {
    const toc: any = {
      id: structuredDoc.id,
      title: structuredDoc.title,
      actNumber: structuredDoc.actNumber,
      year: structuredDoc.year
    };

    if (structuredDoc.chapters && structuredDoc.chapters.length > 0) {
      toc.chapters = structuredDoc.chapters.map(chapter => ({
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
      }));
    }

    if (structuredDoc.parts && structuredDoc.parts.length > 0) {
      toc.parts = structuredDoc.parts.map(part => ({
        id: part.id,
        partNumber: part.partNumber,
        partTitle: part.partTitle,
        sections: part.sections.map(section => ({
          id: section.id,
          sectionNumber: section.sectionNumber,
          sectionTitle: section.sectionTitle
        }))
      }));
    }

    if (structuredDoc.schedules) {
      toc.schedules = structuredDoc.schedules.map(schedule => ({
        id: schedule.id,
        scheduleNumber: schedule.scheduleNumber,
        scheduleTitle: schedule.scheduleTitle
      }));
    }

    return toc;
  }

  static getSectionById(structuredDoc: StructuredDocument, sectionId: string): Section | null {
    if (structuredDoc.chapters) {
      for (const chapter of structuredDoc.chapters) {
        for (const part of chapter.parts) {
          for (const section of part.sections) {
            if (section.id === sectionId) return section;
          }
        }
      }
    }

    if (structuredDoc.parts) {
      for (const part of structuredDoc.parts) {
        for (const section of part.sections) {
          if (section.id === sectionId) return section;
        }
      }
    }

    return null;
  }

  static searchSections(structuredDoc: StructuredDocument, query: string): Section[] {
    const results: Section[] = [];
    const lowerQuery = query.toLowerCase();

    if (structuredDoc.chapters) {
      for (const chapter of structuredDoc.chapters) {
        for (const part of chapter.parts) {
          for (const section of part.sections) {
            if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
              results.push(section);
              continue;
            }
            const contentText = section.markdownContent.join(' ').toLowerCase();
            if (contentText.includes(lowerQuery)) results.push(section);
          }
        }
      }
    }

    if (structuredDoc.parts) {
      for (const part of structuredDoc.parts) {
        for (const section of part.sections) {
          if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
            results.push(section);
            continue;
          }
          const contentText = section.markdownContent.join(' ').toLowerCase();
          if (contentText.includes(lowerQuery)) results.push(section);
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
//   parts?: Part[];
//   schedules: Schedule[];
//   metadata: DocumentMetadata;
// }

// export class DocumentStructuredProcessor {
//   /**
//    * Convert processed content to structured API response format
//    * EACH DOCUMENT TYPE HAS ITS OWN DEDICATED PROCESSOR
//    */
//   static processToStructuredFormat(
//     processedContent: ProcessedContent,
//     documentId: string,
//     originalFileName: string
//   ): StructuredDocument {
//     const { rawText } = processedContent;

//     console.log('=== PROCESSING DOCUMENT ===');
//     console.log('Document filename:', originalFileName);
//     console.log('Text length:', rawText.length);

//     // STEP 1: Detect document type using STRICT, UNIQUE indicators
//     const documentType = this.detectDocumentTypeStrict(rawText, originalFileName);
//     console.log('Detected document type:', documentType);

//     // STEP 2: Route to COMPLETELY SEPARATE processor
//     switch (documentType) {
//       case 'nigeria-tax-act':
//         console.log('>>> ROUTING TO NIGERIA TAX ACT PROCESSOR <<<');
//         return this.processNigeriaTaxAct(rawText, documentId);
      
//       case 'nigeria-revenue-service':
//         console.log('>>> ROUTING TO NIGERIA REVENUE SERVICE PROCESSOR <<<');
//         return this.processNigeriaRevenueService(rawText, documentId);
      
//       case 'joint-revenue-board':
//         console.log('>>> ROUTING TO JOINT REVENUE BOARD PROCESSOR <<<');
//         return this.processJointRevenueBoard(rawText, documentId);
      
//       case 'petroleum-industry-act':
//         console.log('>>> ROUTING TO PIA PROCESSOR <<<');
//         return this.processPetroleumIndustryAct(rawText, documentId);
      
//       default:
//         console.log('>>> UNKNOWN DOCUMENT - FALLBACK TO PIA <<<');
//         return this.processPetroleumIndustryAct(rawText, documentId);
//     }
//   }

//   /**
//    * STRICT document type detection - uses ONLY unique indicators
//    * No overlap between document types
//    */
//   private static detectDocumentTypeStrict(
//     text: string, 
//     filename: string
//   ): 'nigeria-tax-act' | 'nigeria-revenue-service' | 'joint-revenue-board' | 'petroleum-industry-act' {
//     const upperText = text.toUpperCase();
//     const upperFilename = filename.toUpperCase();

//     // ===== NIGERIA TAX ACT - UNIQUE INDICATORS =====
//     // These phrases ONLY appear in Nigeria Tax Act
//     const taxActUniquePhrases = [
//       'TAXATION OF INCOME OF PERSONS',
//       'TAXATION OF INCOME FROM PETROLEUM OPERATIONS',
//       'RELIEF FOR DOUBLE TAXATION',
//       'TAXATION OF DUTIABLE INSTRUMENTS',
//       'CAPITAL GAINS TAX ACT',
//       'CHAPTER TWO - TAXATION OF INCOME'
//     ];

//     for (const phrase of taxActUniquePhrases) {
//       if (upperText.includes(phrase)) {
//         console.log(`[DETECTION] Found Nigeria Tax Act unique phrase: "${phrase}"`);
//         return 'nigeria-tax-act';
//       }
//     }

//     // Additional check: "NIGERIA TAX ACT" but NOT "NIGERIA REVENUE SERVICE"
//     if (upperText.includes('NIGERIA TAX ACT') && 
//         !upperText.includes('NIGERIA REVENUE SERVICE') &&
//         !upperText.includes('JOINT REVENUE BOARD')) {
//       console.log('[DETECTION] Found "NIGERIA TAX ACT" without conflicting indicators');
//       return 'nigeria-tax-act';
//     }

//     // ===== NIGERIA REVENUE SERVICE - UNIQUE INDICATORS =====
//     const nrsUniquePhrases = [
//       'FEDERAL INLAND REVENUE SERVICE (ESTABLISHMENT) ACT',
//       'AN ACT TO REPEAL THE FEDERAL INLAND REVENUE SERVICE',
//       'NIGERIA REVENUE SERVICE (ESTABLISHMENT) ACT, 2025',
//       'EXECUTIVE CHAIRMAN OF THE SERVICE',
//       'GOVERNING BOARD OF THE SERVICE',
//       'TECHNICAL COMMITTEE OF THE BOARD'
//     ];

//     for (const phrase of nrsUniquePhrases) {
//       if (upperText.includes(phrase)) {
//         console.log(`[DETECTION] Found Nigeria Revenue Service unique phrase: "${phrase}"`);
//         return 'nigeria-revenue-service';
//       }
//     }

//     // Check for "NIGERIA REVENUE SERVICE" with "ESTABLISHMENT" but without "JOINT"
//     if (upperText.includes('NIGERIA REVENUE SERVICE') && 
//         upperText.includes('ESTABLISHMENT') &&
//         !upperText.includes('JOINT REVENUE BOARD')) {
//       console.log('[DETECTION] Found "NIGERIA REVENUE SERVICE" + "ESTABLISHMENT" without "JOINT"');
//       return 'nigeria-revenue-service';
//     }

//     // ===== JOINT REVENUE BOARD - UNIQUE INDICATORS =====
//     const jrbUniquePhrases = [
//       'JOINT REVENUE BOARD (ESTABLISHMENT) ACT',
//       'TAX APPEAL TRIBUNAL',
//       'OFFICE OF THE TAX OMBUD',
//       'TAX OMBUD',
//       'COORDINATING SECRETARY TO THE TRIBUNAL',
//       'EXPLANATORY MEMORADUM'
//     ];

//     for (const phrase of jrbUniquePhrases) {
//       if (upperText.includes(phrase)) {
//         console.log(`[DETECTION] Found Joint Revenue Board unique phrase: "${phrase}"`);
//         return 'joint-revenue-board';
//       }
//     }

//     // ===== PETROLEUM INDUSTRY ACT - UNIQUE INDICATORS =====
//     const piaUniquePhrases = [
//       'PETROLEUM INDUSTRY ACT',
//       'UPSTREAM PETROLEUM OPERATIONS',
//       'HOST COMMUNITIES',
//       'PETROLEUM INDUSTRY FISCAL FRAMEWORK'
//     ];

//     for (const phrase of piaUniquePhrases) {
//       if (upperText.includes(phrase)) {
//         console.log(`[DETECTION] Found PIA unique phrase: "${phrase}"`);
//         return 'petroleum-industry-act';
//       }
//     }

//     // Check filename
//     if (upperFilename.includes('PIA') || upperFilename.includes('PETROLEUM')) {
//       return 'petroleum-industry-act';
//     }

//     // Default to PIA
//     return 'petroleum-industry-act';
//   }

//   // ========================================================================
//   // NIGERIA TAX ACT PROCESSOR - COMPLETELY SEPARATE, NO SHARED METHODS
//   // ========================================================================

//   private static processNigeriaTaxAct(text: string, documentId: string): StructuredDocument {
//     console.log('=== NIGERIA TAX ACT - DEDICATED PROCESSOR ===');
    
//     const normalizedText = text
//       .replace(/\r\n/g, '\n')
//       .replace(/\r/g, '\n')
//       .replace(/\u00A0/g, ' ')
//       .replace(/[—–]/g, '-')
//       .trim();

//     // Define chapter boundaries based on section numbers
//     const chapterDefinitions = [
//       { number: 1, title: 'OBJECTIVE AND APPLICATION', startSection: 1, endSection: 2 },
//       { number: 2, title: 'TAXATION OF INCOME OF PERSONS', startSection: 3, endSection: 64 },
//       { number: 3, title: 'TAXATION OF INCOME FROM PETROLEUM OPERATIONS', startSection: 65, endSection: 118 },
//       { number: 4, title: 'RELIEF FOR DOUBLE TAXATION', startSection: 119, endSection: 122 },
//       { number: 5, title: 'TAXATION OF DUTIABLE INSTRUMENTS', startSection: 123, endSection: 142 },
//       { number: 6, title: 'VALUE ADDED TAX', startSection: 143, endSection: 157 },
//       { number: 7, title: 'SURCHARGE', startSection: 158, endSection: 161 },
//       { number: 8, title: 'TAX INCENTIVES', startSection: 162, endSection: 188 },
//       { number: 9, title: 'GENERAL PROVISIONS', startSection: 189, endSection: 202 }
//     ];

//     // Find content start
//     const contentStartIndex = this.nta_findContentStart(normalizedText);
//     let contentText = normalizedText;
//     if (contentStartIndex !== -1) {
//       contentText = normalizedText.substring(contentStartIndex);
//     }

//     // Cut at schedules
//     const scheduleStartIndex = contentText.indexOf('FIRST SCHEDULE');
//     let chaptersText = contentText;
//     if (scheduleStartIndex !== -1) {
//       chaptersText = contentText.substring(0, scheduleStartIndex);
//     }

//     // Extract chapters
//     const chapters = this.nta_splitBySections(chaptersText, chapterDefinitions);
    
//     // Extract schedules
//     const schedules = this.nta_extractSchedules(normalizedText);

//     // NTA-specific metadata
//     const title = this.nta_extractTitle(normalizedText);
//     const actNumber = this.nta_extractActNumber(normalizedText);
//     const year = this.nta_extractYear(normalizedText);
//     const commencementDate = this.nta_extractCommencementDate(normalizedText);
//     const description = this.nta_extractDescription();

//     return {
//       id: documentId,
//       title,
//       actNumber,
//       year,
//       commencementDate,
//       description,
//       chapters: chapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
//       schedules,
//       metadata: {
//         source: 'Federal Republic of Nigeria Official Gazette',
//         publisher: 'Federal Government Printer, Abuja, Nigeria',
//         pageRange: 'A1–A250',
//         format: 'markdown',
//         encoding: 'UTF-8'
//       }
//     };
//   }

//   // NTA Private Methods
//   private static nta_findContentStart(text: string): number {
//     const patterns = [
//       /\n\s*1\.\s+The\s+objective/i,
//       /\n\s*1\.\s+Objective/i,
//       /^1\.\s+The\s+objective/i,
//       /^1\.\s+Objective/i
//     ];

//     for (const pattern of patterns) {
//       const match = text.match(pattern);
//       if (match && match.index !== undefined) {
//         const textBefore = text.substring(0, match.index);
//         const lastChapterIndex = textBefore.lastIndexOf('CHAPTER');
//         if (lastChapterIndex !== -1) {
//           return lastChapterIndex;
//         }
//         return match.index;
//       }
//     }
//     return -1;
//   }

//   private static nta_splitBySections(
//     text: string,
//     chapterDefinitions: Array<{ number: number, title: string, startSection: number, endSection: number }>
//   ): Chapter[] {
//     const chapters: Chapter[] = [];
    
//     const sectionPositions: Array<{ number: number, index: number }> = [];
//     const sectionRegex = /(?:^|\n)(\d{1,3})\.(?:[—–-]?\s*)/g;
//     let match;
    
//     while ((match = sectionRegex.exec(text)) !== null) {
//       if (match.index === undefined) continue;
//       const sectionNumber = parseInt(match[1]);
//       if (sectionNumber >= 1 && sectionNumber <= 202) {
//         sectionPositions.push({ number: sectionNumber, index: match.index });
//       }
//     }
//     sectionPositions.sort((a, b) => a.index - b.index);

//     for (let i = 0; i < chapterDefinitions.length; i++) {
//       const def = chapterDefinitions[i];
//       const startSectionPos = sectionPositions.find(sp => sp.number === def.startSection);
      
//       if (!startSectionPos) {
//         chapters.push(this.nta_createEmptyChapter(def.number, def.title));
//         continue;
//       }

//       let endIndex = text.length;
//       if (i + 1 < chapterDefinitions.length) {
//         const nextSectionPos = sectionPositions.find(sp => sp.number === chapterDefinitions[i + 1].startSection);
//         if (nextSectionPos) endIndex = nextSectionPos.index;
//       }

//       let chapterContent = text.substring(startSectionPos.index, endIndex).trim();
//       let chapterTitle = def.title;
      
//       const textBefore = text.substring(0, startSectionPos.index);
//       const lastChapterIndex = textBefore.lastIndexOf('CHAPTER');
//       if (lastChapterIndex !== -1) {
//         const chapterHeaderLine = textBefore.substring(lastChapterIndex, startSectionPos.index).split('\n')[0];
//         const titleMatch = chapterHeaderLine.match(/[—–-]\s*([^\n]+)/i);
//         if (titleMatch) chapterTitle = titleMatch[1].trim().toUpperCase();
//       }

//       const parts = this.nta_extractParts(chapterContent, def.number, def.startSection, def.endSection);
      
//       chapters.push({
//         id: `ch${def.number}`,
//         chapter: `ch${def.number}`,
//         chapterNumber: def.number,
//         chapterTitle,
//         parts
//       });
//     }

//     return chapters;
//   }

//   private static nta_extractParts(content: string, chapterNumber: number, startSection: number, endSection: number): Part[] {
//     const parts: Part[] = [];
//     if (!content.trim()) return parts;

//     let cleanContent = content.replace(/^CHAPTER\s+(?:ONE|1|TWO|2|THREE|3|FOUR|4|FIVE|5|SIX|6|SEVEN|7|EIGHT|8|NINE|9|TEN|10)[—–-][^\n]*\n?/i, '');

//     const partHeaders: Array<{ title: string, index: number, header: string }> = [];
//     const partRegex = /PART\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X|1|2|3|4|5|6|7|8|9|10|ONE|TWO|THREE|FOUR|FIVE)[—–-][^\n]*/gi;
//     let match;
    
//     while ((match = partRegex.exec(cleanContent)) !== null) {
//       if (match.index === undefined) continue;
//       let partTitle = '';
//       const titleMatch = match[0].match(/[—–-]\s*([^\n]+)/i);
//       if (titleMatch) partTitle = titleMatch[1].trim().toUpperCase();
//       partHeaders.push({ title: partTitle, index: match.index, header: match[0] });
//     }
//     partHeaders.sort((a, b) => a.index - b.index);

//     if (partHeaders.length === 0) {
//       const sections = this.nta_extractSections(cleanContent, chapterNumber, 1, startSection, endSection);
//       parts.push({
//         id: `ch${chapterNumber}-pt1`,
//         part: `ch${chapterNumber}-pt1`,
//         partNumber: 1,
//         partTitle: 'PROVISIONS',
//         sections
//       });
//       return parts;
//     }

//     for (let i = 0; i < partHeaders.length; i++) {
//       const current = partHeaders[i];
//       let partEndIndex = cleanContent.length;
//       if (i + 1 < partHeaders.length) partEndIndex = partHeaders[i + 1].index;
      
//       const partContent = cleanContent.substring(current.index + current.header.length, partEndIndex).trim();
//       const sections = this.nta_extractSections(partContent, chapterNumber, i + 1, startSection, endSection);
      
//       parts.push({
//         id: `ch${chapterNumber}-pt${i + 1}`,
//         part: `ch${chapterNumber}-pt${i + 1}`,
//         partNumber: i + 1,
//         partTitle: current.title || `PART ${i + 1}`,
//         sections
//       });
//     }
//     return parts;
//   }

//   private static nta_extractSections(content: string, chapterNumber: number, partNumber: number, startSection: number, endSection: number): Section[] {
//     const sections: Section[] = [];
//     if (!content.trim()) return sections;

//     const sectionRegex = /(?:^|\n)(\d{1,3})\.(?:[—–-]?\s*)?([^\n]*)/g;
//     const sectionMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];
//     let match;

//     while ((match = sectionRegex.exec(content)) !== null) {
//       if (match.index === undefined) continue;
//       const sectionNumber = parseInt(match[1]);
//       if (sectionNumber < startSection || sectionNumber > endSection) continue;
//       let sectionTitle = match[2].trim();
//       sectionTitle = sectionTitle.replace(/^[—–.\s-]+/, '').replace(/[—–.\s-]+$/, '');
//       sectionMatches.push({ number: sectionNumber, title: sectionTitle, index: match.index, fullMatch: match[0] });
//     }

//     for (let i = 0; i < sectionMatches.length; i++) {
//       const current = sectionMatches[i];
//       let sectionEnd = content.length;
//       if (i + 1 < sectionMatches.length) sectionEnd = sectionMatches[i + 1].index;

//       const sectionStart = current.index + current.fullMatch.length;
//       let sectionContent = content.substring(sectionStart, sectionEnd).trim();

//       const subsections = this.nta_extractSubsections(sectionContent, chapterNumber, partNumber, current.number);
//       let mainContent = sectionContent;
      
//       const firstSubMatch = /\((\d+)\)/g.exec(sectionContent);
//       if (firstSubMatch && firstSubMatch.index !== undefined) {
//         mainContent = sectionContent.substring(0, firstSubMatch.index).trim();
//         mainContent = this.nta_cleanText(mainContent);
//       }

//       mainContent = this.nta_cleanText(mainContent);

//       if (current.title || mainContent) {
//         sections.push({
//           id: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
//           section: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
//           sectionNumber: current.number,
//           sectionTitle: current.title || `Section ${current.number}`,
//           markdownContent: mainContent ? [mainContent] : []
//         });
//       }
//       sections.push(...subsections);
//     }

//     return sections.sort((a, b) => {
//       if (a.sectionNumber !== b.sectionNumber) return a.sectionNumber - b.sectionNumber;
//       const aIsSub = a.id.includes('-us');
//       const bIsSub = b.id.includes('-us');
//       if (aIsSub && !bIsSub) return 1;
//       if (!aIsSub && bIsSub) return -1;
//       return 0;
//     });
//   }

//   private static nta_extractSubsections(content: string, chapterNumber: number, partNumber: number, sectionNumber: number): Section[] {
//     const subsections: Section[] = [];
//     if (!content) return subsections;

//     const subsectionRegex = /\((\d+)\)(?:\s*[—–-]?\s*)?([^\n]*)/gi;
//     const positions: Array<{ number: string, title: string, index: number, fullMatch: string }> = [];
//     let match;

//     while ((match = subsectionRegex.exec(content)) !== null) {
//       if (match.index === undefined) continue;
//       let subTitle = match[2].trim().replace(/\s+/g, ' ');
//       positions.push({ number: match[1], title: subTitle, index: match.index, fullMatch: match[0] });
//     }

//     let counter = 1;
//     for (let i = 0; i < positions.length; i++) {
//       const current = positions[i];
//       let endIndex = content.length;
//       if (i + 1 < positions.length) endIndex = positions[i + 1].index;

//       const subStart = current.index + current.fullMatch.length;
//       let subContent = content.substring(subStart, endIndex).trim();
//       subContent = subContent.replace(/^[A-Z]\d+\s*$/gm, '').replace(/^\s*\d{1,3}\s*$/gm, '');
//       subContent = subContent.replace(/\n{3,}/g, '\n\n').replace(/\s+/g, ' ').trim();

//       subsections.push({
//         id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${counter}`,
//         section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${counter}`,
//         sectionNumber,
//         sectionTitle: `(${current.number})${current.title ? ' ' + current.title : ''}`,
//         markdownContent: subContent ? [subContent] : []
//       });
//       counter++;
//     }
//     return subsections;
//   }

//   private static nta_cleanText(text: string): string {
//     if (!text) return '';
//     return text.replace(/^[A-Z]\d+\s*$/gm, '').replace(/^\s*\d{1,3}\s*$/gm, '')
//       .replace(/\n{3,}/g, '\n\n').replace(/\s+/g, ' ').trim();
//   }

//   private static nta_createEmptyChapter(chapterNumber: number, title: string): Chapter {
//     return {
//       id: `ch${chapterNumber}`,
//       chapter: `ch${chapterNumber}`,
//       chapterNumber,
//       chapterTitle: title,
//       parts: [{
//         id: `ch${chapterNumber}-pt1`,
//         part: `ch${chapterNumber}-pt1`,
//         partNumber: 1,
//         partTitle: 'PROVISIONS',
//         sections: []
//       }]
//     };
//   }

//   private static nta_extractSchedules(text: string): Schedule[] {
//     const schedules: Schedule[] = [];
//     const scheduleStartIndex = text.indexOf('FIRST SCHEDULE');
//     if (scheduleStartIndex === -1) return this.nta_getPlaceholderSchedules();

//     const schedulesText = text.substring(scheduleStartIndex);
//     const scheduleDefs = [
//       { name: 'First', number: 1 }, { name: 'Second', number: 2 }, { name: 'Third', number: 3 },
//       { name: 'Fourth', number: 4 }, { name: 'Fifth', number: 5 }, { name: 'Sixth', number: 6 },
//       { name: 'Seventh', number: 7 }, { name: 'Eighth', number: 8 }, { name: 'Ninth', number: 9 },
//       { name: 'Tenth', number: 10 }, { name: 'Eleventh', number: 11 }, { name: 'Twelfth', number: 12 },
//       { name: 'Thirteenth', number: 13 }, { name: 'Fourteenth', number: 14 }
//     ];

//     for (const def of scheduleDefs) {
//       schedules.push({
//         id: `sch${def.number}`,
//         schedule: `sch${def.number}`,
//         scheduleNumber: def.number,
//         scheduleTitle: `${def.name} Schedule`,
//         markdownContent: [`${def.name} Schedule content.`]
//       });
//     }
//     return schedules;
//   }

//   private static nta_getPlaceholderSchedules(): Schedule[] {
//     return [
//       { id: 'sch1', schedule: 'sch1', scheduleNumber: 1, scheduleTitle: 'First Schedule', markdownContent: ['Provisions relating to income tax rates.'] }
//     ];
//   }

//   private static nta_extractTitle(text: string): string {
//     const match = text.match(/NIGERIA\s+TAX\s+ACT[,\s]*(\d{4})/i);
//     return match ? `Nigeria Tax Act, ${match[1]}` : 'Nigeria Tax Act, 2025';
//   }

//   private static nta_extractActNumber(text: string): string {
//     const match = text.match(/ACT\s+No\.?\s*(\d+)/i);
//     return match ? `No. ${match[1]}` : 'No. 7';
//   }

//   private static nta_extractYear(text: string): number {
//     const match = text.match(/20\d{2}/);
//     return match ? parseInt(match[0]) : 2025;
//   }

//   private static nta_extractCommencementDate(text: string): string {
//     return '1st January, 2026';
//   }

//   private static nta_extractDescription(): string {
//     return 'An Act to repeal various tax laws and consolidate the legal frameworks relating to taxation in Nigeria, providing for taxation of income, transactions and instruments.';
//   }

//   // ========================================================================
// // NIGERIA REVENUE SERVICE PROCESSOR - BODY TEXT EXTRACTION
// // ========================================================================

// private static processNigeriaRevenueService(text: string, documentId: string): StructuredDocument {
//   console.log('=== NIGERIA REVENUE SERVICE - BODY TEXT EXTRACTION ===');
  
//   const normalizedText = text
//     .replace(/\r\n/g, '\n')
//     .replace(/\r/g, '\n')
//     .replace(/\u00A0/g, ' ')
//     .replace(/[—–]/g, '-')
//     .trim();

//   // CRITICAL: Find the ACTUAL body text after the ENACTED line
//   // The document has: "ENACTED by the National Assembly of the Federal Republic of Nigeria – PART I – OBJECTIVE AND APPLICATION"
//   const enactedPattern = /ENACTED\s+by\s+the\s+National\s+Assembly\s+of\s+the\s+Federal\s+Republic\s+of\s+Nigeria\s*[—–-]\s*/i;
//   const enactedMatch = normalizedText.match(enactedPattern);
  
//   let bodyText = normalizedText;
  
//   if (enactedMatch && enactedMatch.index !== undefined) {
//     // Start from AFTER the "ENACTED..." line
//     bodyText = normalizedText.substring(enactedMatch.index + enactedMatch[0].length);
//     console.log('[NRS] Found ENACTED line, starting body text after it');
//   } else {
//     // Fallback: look for "PART I – OBJECTIVE AND APPLICATION" in the body section
//     const partOneInBody = normalizedText.match(/PART\s+I\s*[—–-]\s*OBJECTIVE\s+AND\s+APPLICATION\s*\n\s*1\./i);
//     if (partOneInBody && partOneInBody.index !== undefined) {
//       bodyText = normalizedText.substring(partOneInBody.index);
//       console.log('[NRS] Found PART I with section 1 in body at index:', partOneInBody.index);
//     }
//   }

//   console.log('[NRS] Body text starts with:', bodyText.substring(0, 300));

//   // Find where schedules start in the BODY (not TOC)
//   // Look for "SCHEDULES" heading that appears before the actual schedules
//   let scheduleStartIndex = bodyText.indexOf('\nSCHEDULES\n');
//   if (scheduleStartIndex === -1) {
//     scheduleStartIndex = bodyText.indexOf('FIRST SCHEDULE');
//   }
  
//   let partsText = bodyText;
//   if (scheduleStartIndex !== -1) {
//     partsText = bodyText.substring(0, scheduleStartIndex);
//     console.log(`[NRS] Cut parts at schedule start (index ${scheduleStartIndex})`);
//   }

//   // Extract parts from BODY text
//   const parts = this.nrs_extractPartsFromBody(partsText);
//   console.log(`[NRS] Extracted ${parts.length} parts from body`);

//   // Extract schedules
//   const schedules = this.nrs_extractSchedulesFromBody(normalizedText);
//   console.log(`[NRS] Extracted ${schedules.length} schedules`);

//   // Metadata
//   const title = this.nrs_extractTitle(text);
//   const actNumber = this.nrs_extractActNumber(text);
//   const year = this.nrs_extractYear(text);
//   const commencementDate = this.nrs_extractCommencementDate(text);
//   const description = this.nrs_extractDescription(text);

//   return {
//     id: documentId,
//     title,
//     actNumber,
//     year,
//     commencementDate,
//     description,
//     chapters: [],
//     parts,
//     schedules,
//     metadata: {
//       source: 'Federal Republic of Nigeria Official Gazette',
//       publisher: 'Federal Government Printer, Lagos, Nigeria',
//       pageRange: 'A231–A257',
//       format: 'markdown',
//       encoding: 'UTF-8'
//     }
//   };
// }

// /**
//  * Extract parts from BODY text (not TOC)
//  */
// private static nrs_extractPartsFromBody(text: string): Part[] {
//   const parts: Part[] = [];
//   if (!text.trim()) return parts;

//   // Find PART headers in the body
//   const partPattern = /PART\s+(I|II|III|IV|V|VI|VII)\s*[—–-]\s*([^\n]+)/gi;
//   const partMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

//   const romanMap: { [key: string]: number } = {
//     'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7
//   };

//   let match;
//   while ((match = partPattern.exec(text)) !== null) {
//     if (match.index === undefined) continue;
    
//     const partNumber = romanMap[match[1].toUpperCase()] || 1;
//     let partTitle = match[2].trim().toUpperCase();
    
//     // Check if title continues on next line (for Part 3)
//     if (partNumber === 3 && partTitle === 'ESTABLISHMENT AND COMPOSITION OF THE GOVERNING') {
//       const afterMatch = text.substring(match.index + match[0].length, match.index + match[0].length + 50);
//       const boardMatch = afterMatch.match(/^\s*BOARD\s+OF\s+THE\s+SERVICE/i);
//       if (boardMatch) {
//         partTitle = partTitle + ' ' + boardMatch[0].trim();
//       }
//     }

//     partMatches.push({ 
//       number: partNumber, 
//       title: partTitle, 
//       index: match.index, 
//       fullMatch: match[0] 
//     });
    
//     console.log(`[NRS] Found PART ${partNumber}: "${partTitle}" at index ${match.index}`);
//   }

//   partMatches.sort((a, b) => a.index - b.index);

//   for (let i = 0; i < partMatches.length; i++) {
//     const current = partMatches[i];
//     let endIndex = text.length;
//     if (i + 1 < partMatches.length) {
//       endIndex = partMatches[i + 1].index;
//     }

//     const partContent = text.substring(current.index + current.fullMatch.length, endIndex);
//     const sections = this.nrs_extractSectionsFromBody(partContent, current.number);
    
//     if (sections.length > 0) {
//       parts.push({
//         id: `pt${current.number}`,
//         part: `pt${current.number}`,
//         partNumber: current.number,
//         partTitle: current.title,
//         sections
//       });
//     }
//   }

//   // Deduplicate
//   const uniqueParts: Part[] = [];
//   const seen = new Set<number>();
//   for (const part of parts) {
//     if (!seen.has(part.partNumber)) {
//       seen.add(part.partNumber);
//       uniqueParts.push(part);
//     }
//   }
  
//   return uniqueParts.sort((a, b) => a.partNumber - b.partNumber);
// }

// /**
//  * Extract sections from BODY content with FULL titles
//  */
// private static nrs_extractSectionsFromBody(content: string, partNumber: number): Section[] {
//   const sections: Section[] = [];
//   if (!content.trim()) return sections;

//   let cleanContent = content;
  
//   // Remove page artifacts
//   cleanContent = cleanContent.replace(/^[A-Z]\d+\s*$/gm, '');
//   cleanContent = cleanContent.replace(/^\s*\d+\s*$/gm, '');

//   // Find section headers with their FULL titles from the body
//   // Body sections look like: "1. The objective of this Act is to provide for a legal..."
//   const sectionPattern = /(?:^|\n)\s*(\d{1,3})\.\s+([^\n]+)/g;
//   const sectionMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

//   let match;
//   while ((match = sectionPattern.exec(cleanContent)) !== null) {
//     if (match.index === undefined) continue;
    
//     const sectionNumber = parseInt(match[1]);
//     if (sectionNumber > 200) continue;
    
//     let sectionTitle = match[2].trim().replace(/\s+/g, ' ');
    
//     sectionMatches.push({ 
//       number: sectionNumber, 
//       title: sectionTitle, 
//       index: match.index, 
//       fullMatch: match[0] 
//     });
//   }

//   console.log(`[NRS] Part ${partNumber}: Found ${sectionMatches.length} sections in body`);

//   for (let i = 0; i < sectionMatches.length; i++) {
//     const current = sectionMatches[i];
//     let endIndex = cleanContent.length;
//     if (i + 1 < sectionMatches.length) {
//       endIndex = sectionMatches[i + 1].index;
//     }

//     const sectionStart = current.index + current.fullMatch.length;
//     const sectionContent = cleanContent.substring(sectionStart, endIndex);
    
//     // Extract ALL subsections
//     const subsections = this.nrs_extractSubsectionsFromBody(sectionContent, partNumber, current.number);
    
//     // Check if there's content before the first subsection
//     const firstSubIndex = sectionContent.search(/\(\s*\d+\s*\)/);
    
//     if (firstSubIndex === -1) {
//       // No subsections - all content goes to main section
//       const cleaned = this.nrs_cleanBodyText(sectionContent);
//       sections.push({
//         id: `pt${partNumber}-s${current.number}`,
//         section: `pt${partNumber}-s${current.number}`,
//         sectionNumber: current.number,
//         sectionTitle: current.title,
//         markdownContent: cleaned ? [cleaned] : []
//       });
//     } else if (firstSubIndex > 0) {
//       // Has content before first subsection
//       const mainContent = sectionContent.substring(0, firstSubIndex).trim();
//       const cleanedMain = this.nrs_cleanBodyText(mainContent);
      
//       sections.push({
//         id: `pt${partNumber}-s${current.number}`,
//         section: `pt${partNumber}-s${current.number}`,
//         sectionNumber: current.number,
//         sectionTitle: current.title,
//         markdownContent: cleanedMain ? [cleanedMain] : []
//       });
      
//       sections.push(...subsections);
//     } else {
//       // Section starts immediately with subsection
//       sections.push(...subsections);
//     }
//   }

//   // Deduplicate
//   const uniqueSections: Section[] = [];
//   const seenIds = new Set<string>();
//   for (const section of sections) {
//     if (!seenIds.has(section.id)) {
//       seenIds.add(section.id);
//       uniqueSections.push(section);
//     }
//   }
  
//   return uniqueSections;
// }

// /**
//  * Extract subsections from BODY content
//  */
// private static nrs_extractSubsectionsFromBody(content: string, partNumber: number, sectionNumber: number): Section[] {
//   const subsections: Section[] = [];
//   if (!content.trim()) return subsections;

//   // Find all subsections
//   const subPattern = /\(\s*(\d+)\s*\)/g;
//   const subMatches: Array<{ number: string, index: number, fullMatch: string }> = [];

//   let match;
//   while ((match = subPattern.exec(content)) !== null) {
//     if (match.index === undefined) continue;
//     subMatches.push({ number: match[1], index: match.index, fullMatch: match[0] });
//   }

//   for (let i = 0; i < subMatches.length; i++) {
//     const current = subMatches[i];
//     let endIndex = content.length;
//     if (i + 1 < subMatches.length) {
//       endIndex = subMatches[i + 1].index;
//     }

//     // Get the title on the same line
//     const afterSub = content.substring(current.index + current.fullMatch.length);
//     const nextNewline = afterSub.indexOf('\n');
//     const nextOpenParen = afterSub.indexOf('(');
    
//     let titleEnd = afterSub.length;
//     if (nextNewline !== -1) titleEnd = Math.min(titleEnd, nextNewline);
//     if (nextOpenParen !== -1) titleEnd = Math.min(titleEnd, nextOpenParen);
    
//     let title = afterSub.substring(0, titleEnd).trim();
//     title = title.replace(/\s*[—–-]\s*$/, '').replace(/\s+/g, ' ');

//     // Extract content
//     let contentStart = current.index;
//     if (nextNewline !== -1) {
//       contentStart = current.index + current.fullMatch.length + nextNewline + 1;
//     } else {
//       contentStart = current.index + current.fullMatch.length + title.length;
//     }

//     let subContent = content.substring(contentStart, endIndex).trim();
//     subContent = this.nrs_cleanBodyText(subContent);

//     const fullTitle = `(${current.number})${title ? ' ' + title : ''}`;

//     subsections.push({
//       id: `pt${partNumber}-s${sectionNumber}-us${i + 1}`,
//       section: `pt${partNumber}-s${sectionNumber}-us${i + 1}`,
//       sectionNumber,
//       sectionTitle: fullTitle,
//       markdownContent: subContent ? [subContent] : []
//     });
//   }

//   return subsections;
// }

// /**
//  * Clean body text
//  */
// private static nrs_cleanBodyText(text: string): string {
//   if (!text) return '';
  
//   let cleaned = text;
  
//   // Remove page artifacts
//   cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
//   cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
  
//   // Remove stray headers that appear in body
//   const headersToRemove = [
//     'Objective', 'Application', 'Functions of the Service', 
//     'Powers of the Board', 'Establishment of the', 'Commencement',
//     'Establishment', 'Fund of the Service', 'Expenditure of the Service',
//     'Estimates', 'Accounts and audit', 'Annual report', 'Pension',
//     'Staff regulations', 'Citation'
//   ];
  
//   for (const header of headersToRemove) {
//     const pattern = new RegExp(`^\\s*${header}\\s*$`, 'gim');
//     cleaned = cleaned.replace(pattern, '');
//   }
  
//   // Fix hyphenated words
//   cleaned = cleaned.replace(/([a-zA-Z])-\s*\n\s*([a-zA-Z])/g, '$1$2');
  
//   // Format letter items
//   cleaned = cleaned.replace(/\(\s*([a-z])\s*\)/g, '($1)');
//   cleaned = cleaned.replace(/\(\s*([ivx]+)\s*\)/gi, '($1)');
  
//   // Clean spacing
//   cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
//   cleaned = cleaned.replace(/\s+\)/g, ')');
//   cleaned = cleaned.replace(/\(\s+/g, '(');
//   cleaned = cleaned.replace(/\s*,\s*/g, ', ');
//   cleaned = cleaned.replace(/\s*;\s*/g, '; ');
//   cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
//   cleaned = cleaned.replace(/ {2,}/g, ' ');
//   cleaned = cleaned.replace(/^\s+/, '');
  
//   return cleaned.trim();
// }

// /**
//  * Extract schedules
//  */
// private static nrs_extractSchedulesFromBody(text: string): Schedule[] {
//   const schedules: Schedule[] = [];
  
//   let firstScheduleIndex = text.indexOf('FIRST SCHEDULE');
//   if (firstScheduleIndex === -1) {
//     firstScheduleIndex = text.indexOf('\nSCHEDULES\n');
//   }
  
//   if (firstScheduleIndex === -1) {
//     console.log('[NRS] No schedules found');
//     return this.nrs_getPlaceholderSchedules();
//   }

//   const schedulesText = text.substring(firstScheduleIndex);

//   const scheduleDefs = [
//     { name: 'First', number: 1, pattern: /FIRST\s+SCHEDULE/i },
//     { name: 'Second', number: 2, pattern: /SECOND\s+SCHEDULE/i },
//     { name: 'Third', number: 3, pattern: /THIRD\s+SCHEDULE/i }
//   ];

//   const positions: Array<{ name: string; number: number; index: number }> = [];

//   for (const def of scheduleDefs) {
//     const match = schedulesText.match(def.pattern);
//     if (match && match.index !== undefined) {
//       positions.push({ name: def.name, number: def.number, index: match.index });
//     }
//   }

//   positions.sort((a, b) => a.index - b.index);

//   for (let i = 0; i < positions.length; i++) {
//     const current = positions[i];
    
//     let endIndex = schedulesText.length;
//     if (i + 1 < positions.length) {
//       endIndex = positions[i + 1].index;
//     }

//     let content = schedulesText.substring(current.index, endIndex);
    
//     content = content.replace(new RegExp(`^${current.name}\\s+SCHEDULE[^\\n]*\\n?`, 'i'), '');
//     content = content.replace(/^Section\s+\d+\s*\([^)]+\).*?\n/i, '');
//     content = content.replace(/^SUPPLEMENTARY\s+PROVISIONS[^\n]*\n/i, '');
//     content = content.replace(/^LEGISLATIONS\s+ADMINISTERED[^\n]*\n/i, '');
//     content = content.replace(/^Form\s+of\s+Warrant[^\n]*\n/i, '');

//     content = content.replace(/^[A-Z]\d+\s*$/gm, '');
//     content = content.replace(/^\s*\d+\s*$/gm, '');
//     content = content.replace(/\n{3,}/g, '\n\n');
//     content = content.replace(/ {2,}/g, ' ');

//     const lines = content.split('\n')
//       .map(l => l.trim())
//       .filter(l => l.length > 0 && 
//                    !l.includes('SCHEDULE') && 
//                    !l.includes('Section') &&
//                    !l.includes('SUPPLEMENTARY'));

//     const cleanedContent = lines.join('\n').trim();

//     const descriptions: { [key: number]: string } = {
//       1: 'Supplementary provisions relating to the Board.',
//       2: 'Legislations administered by the Service.',
//       3: 'Form of Warrant of Deduction at Source.'
//     };

//     schedules.push({
//       id: `sch${current.number}`,
//       schedule: `sch${current.number}`,
//       scheduleNumber: current.number,
//       scheduleTitle: `${current.name} Schedule`,
//       markdownContent: cleanedContent ? [cleanedContent] : [descriptions[current.number]]
//     });
//   }

//   return schedules.length > 0 ? schedules : this.nrs_getPlaceholderSchedules();
// }

// private static nrs_getPlaceholderSchedules(): Schedule[] {
//   return [
//     { id: 'sch1', schedule: 'sch1', scheduleNumber: 1, scheduleTitle: 'First Schedule', markdownContent: ['Supplementary provisions relating to the Board.'] },
//     { id: 'sch2', schedule: 'sch2', scheduleNumber: 2, scheduleTitle: 'Second Schedule', markdownContent: ['Legislations administered by the Service.'] },
//     { id: 'sch3', schedule: 'sch3', scheduleNumber: 3, scheduleTitle: 'Third Schedule', markdownContent: ['Form of Warrant of Deduction at Source.'] }
//   ];
// }

//   private static nrs_extractTitle(text: string): string {
//     const match = text.match(/NIGERIA\s+REVENUE\s+SERVICE\s*\(ESTABLISHMENT\)\s+ACT[,\s]*(\d{4})/i);
//     return match ? `Nigeria Revenue Service (Establishment) Act, ${match[1]}` : 'Nigeria Revenue Service (Establishment) Act, 2025';
//   }

//   private static nrs_extractActNumber(text: string): string {
//     const match = text.match(/ACT\s+NO\.?\s*(\d+)/i);
//     return match ? `No. ${match[1]}` : 'No. 4';
//   }

//   private static nrs_extractYear(text: string): number {
//     const match = text.match(/20\d{2}/);
//     return match ? parseInt(match[0]) : 2025;
//   }

//   private static nrs_extractCommencementDate(text: string): string {
//     const match = text.match(/\[\s*(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s*,?\s*\d{4})\s*\]/i);
//     return match ? match[1] : '26th June, 2025';
//   }

//   private static nrs_extractDescription(text: string): string {
//     const match = text.match(/AN\s+ACT\s+TO\s+REPEAL\s+THE\s+FEDERAL\s+INLAND\s+REVENUE\s+SERVICE[^;]+;/i);
//     return match ? match[0].trim() : 'An Act to repeal the Federal Inland Revenue Service (Establishment) Act and enact the Nigeria Revenue Service (Establishment) Act, 2025.';
//   }

//   // ========================================================================
//   // JOINT REVENUE BOARD PROCESSOR - COMPLETELY SEPARATE
//   // ========================================================================

//   private static processJointRevenueBoard(text: string, documentId: string): StructuredDocument {
//     console.log('=== JOINT REVENUE BOARD - DEDICATED PROCESSOR ===');
    
//     const normalizedText = text
//       .replace(/\r\n/g, '\n')
//       .replace(/\r/g, '\n')
//       .replace(/\u00A0/g, ' ')
//       .replace(/[—–]/g, '-')
//       .trim();

//     const bodyStartMatch = normalizedText.match(/ENACTED\s+by\s+the\s+National\s+Assembly[^\n]*\n/i);
//     let bodyText = normalizedText;
//     if (bodyStartMatch && bodyStartMatch.index !== undefined) {
//       const afterEnacted = normalizedText.substring(bodyStartMatch.index);
//       const firstNewline = afterEnacted.indexOf('\n');
//       if (firstNewline !== -1) bodyText = afterEnacted.substring(firstNewline + 1);
//     }

//     const scheduleStartIndex = bodyText.indexOf('FIRST SCHEDULE');
//     let partsText = bodyText;
//     if (scheduleStartIndex !== -1) partsText = bodyText.substring(0, scheduleStartIndex);

//     const parts = this.jrb_extractParts(partsText);
//     const schedules = this.jrb_extractSchedules(normalizedText);

//     const title = this.jrb_extractTitle(normalizedText);
//     const actNumber = this.jrb_extractActNumber(normalizedText);
//     const year = this.jrb_extractYear(normalizedText);
//     const description = this.jrb_extractDescription(normalizedText);

//     return {
//       id: documentId,
//       title,
//       actNumber,
//       year,
//       commencementDate: '2025-01-01',
//       description,
//       chapters: [],
//       parts,
//       schedules,
//       metadata: {
//         source: 'Federal Republic of Nigeria Official Gazette',
//         publisher: 'Federal Government Printer, Abuja, Nigeria',
//         pageRange: 'A1–A50',
//         format: 'markdown',
//         encoding: 'UTF-8'
//       }
//     };
//   }

//   private static jrb_extractParts(text: string): Part[] {
//     const parts: Part[] = [];
//     if (!text.trim()) return parts;

//     const partPattern = /PART\s+(I|II|III|IV|V|VI|VII)\s*[—–-]\s*([^\n]+)/gi;
//     const partMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

//     let match;
//     const romanMap: { [key: string]: number } = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7 };
    
//     while ((match = partPattern.exec(text)) !== null) {
//       if (match.index === undefined) continue;
//       const partNumber = romanMap[match[1].toUpperCase()] || 1;
//       const partTitle = match[2].trim().toUpperCase();
//       partMatches.push({ number: partNumber, title: partTitle, index: match.index, fullMatch: match[0] });
//     }

//     partMatches.sort((a, b) => a.index - b.index);

//     for (let i = 0; i < partMatches.length; i++) {
//       const current = partMatches[i];
//       let endIndex = text.length;
//       if (i + 1 < partMatches.length) endIndex = partMatches[i + 1].index;

//       const partContent = text.substring(current.index + current.fullMatch.length, endIndex);
//       const sections = this.jrb_extractSections(partContent, current.number);
      
//       if (sections.length > 0) {
//         parts.push({
//           id: `pt${current.number}`,
//           part: `pt${current.number}`,
//           partNumber: current.number,
//           partTitle: current.title,
//           sections
//         });
//       }
//     }

//     const uniqueParts: Part[] = [];
//     const seen = new Set<number>();
//     for (const part of parts) {
//       if (!seen.has(part.partNumber)) {
//         seen.add(part.partNumber);
//         uniqueParts.push(part);
//       }
//     }
//     return uniqueParts.sort((a, b) => a.partNumber - b.partNumber);
//   }

//   private static jrb_extractSections(content: string, partNumber: number): Section[] {
//     const sections: Section[] = [];
//     if (!content.trim()) return sections;

//     const cleanContent = content.replace(/^[A-Z]\d+\s*$/gm, '').replace(/^\s*\d+\s*$/gm, '');
//     const sectionPattern = /(?:^|\n)\s*(\d{1,3})\.\s+([^\n]+)/g;
//     const sectionMatches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

//     let match;
//     while ((match = sectionPattern.exec(cleanContent)) !== null) {
//       if (match.index === undefined) continue;
//       const sectionNumber = parseInt(match[1]);
//       if (sectionNumber > 200) continue;
//       const sectionTitle = match[2].trim().replace(/\s+/g, ' ');
//       sectionMatches.push({ number: sectionNumber, title: sectionTitle, index: match.index, fullMatch: match[0] });
//     }

//     for (let i = 0; i < sectionMatches.length; i++) {
//       const current = sectionMatches[i];
//       let endIndex = cleanContent.length;
//       if (i + 1 < sectionMatches.length) endIndex = sectionMatches[i + 1].index;

//       const sectionContent = cleanContent.substring(current.index + current.fullMatch.length, endIndex);
//       const trimmedContent = sectionContent.trim();

//       if (/^\s*\(\d+\)/.test(trimmedContent)) {
//         const subsections = this.jrb_extractSubsections(sectionContent, partNumber, current.number);
//         sections.push(...subsections);
//       } else {
//         const mainSection: Section = {
//           id: `pt${partNumber}-s${current.number}`,
//           section: `pt${partNumber}-s${current.number}`,
//           sectionNumber: current.number,
//           sectionTitle: current.title,
//           markdownContent: []
//         };

//         const firstSubIndex = sectionContent.search(/\(\d+\)/);
//         if (firstSubIndex !== -1) {
//           const mainContent = sectionContent.substring(0, firstSubIndex).trim();
//           if (mainContent) mainSection.markdownContent = [this.jrb_cleanText(mainContent)];
          
//           const subsections = this.jrb_extractSubsections(sectionContent.substring(firstSubIndex), partNumber, current.number);
//           sections.push(mainSection);
//           sections.push(...subsections);
//         } else {
//           const cleaned = this.jrb_cleanText(sectionContent);
//           if (cleaned) mainSection.markdownContent = [cleaned];
//           sections.push(mainSection);
//         }
//       }
//     }

//     const uniqueSections: Section[] = [];
//     const seenIds = new Set<string>();
//     for (const section of sections) {
//       if (!seenIds.has(section.id)) {
//         seenIds.add(section.id);
//         uniqueSections.push(section);
//       }
//     }
//     return uniqueSections;
//   }

//   private static jrb_extractSubsections(content: string, partNumber: number, sectionNumber: number): Section[] {
//     const subsections: Section[] = [];
//     if (!content.trim()) return subsections;

//     const subPattern = /\(\s*(\d+)\s*\)\s*([^\n(]*)/g;
//     const subMatches: Array<{ number: string, title: string, index: number, fullMatch: string }> = [];

//     let match;
//     while ((match = subPattern.exec(content)) !== null) {
//       if (match.index === undefined) continue;
//       let title = match[2].trim().replace(/\s*[—–-]\s*$/, '');
//       subMatches.push({ number: match[1], title, index: match.index, fullMatch: match[0] });
//     }

//     for (let i = 0; i < subMatches.length; i++) {
//       const current = subMatches[i];
//       let endIndex = content.length;
//       if (i + 1 < subMatches.length) endIndex = subMatches[i + 1].index;

//       const afterTitle = content.substring(current.index);
//       const firstNewline = afterTitle.indexOf('\n');
//       let contentStart = current.index;
//       if (firstNewline !== -1) {
//         contentStart = current.index + firstNewline + 1;
//       } else {
//         contentStart = current.index + current.fullMatch.length;
//       }

//       let subContent = content.substring(contentStart, endIndex).trim();
//       subContent = this.jrb_cleanText(subContent);

//       subsections.push({
//         id: `pt${partNumber}-s${sectionNumber}-us${i + 1}`,
//         section: `pt${partNumber}-s${sectionNumber}-us${i + 1}`,
//         sectionNumber,
//         sectionTitle: `(${current.number})${current.title ? ' ' + current.title : ''}`,
//         markdownContent: subContent ? [subContent] : []
//       });
//     }
//     return subsections;
//   }

//   private static jrb_cleanText(text: string): string {
//     if (!text) return '';
//     return text.replace(/^[A-Z]\d+\s*$/gm, '').replace(/^\s*\d+\s*$/gm, '')
//       .replace(/^(?:Objectives|Application|Composition|Board|Functions|Powers|Establishment)\s*$/gim, '')
//       .replace(/([a-zA-Z])-\s*\n\s*([a-zA-Z])/g, '$1$2')
//       .replace(/\(\s*([a-z])\s*\)/g, '($1)')
//       .replace(/\(\s*([ivx]+)\s*\)/gi, '($1)')
//       .replace(/\n{3,}/g, '\n\n').replace(/\s+/g, ' ').trim();
//   }

//   private static jrb_extractSchedules(text: string): Schedule[] {
//     return [
//       { id: 'sch1', schedule: 'sch1', scheduleNumber: 1, scheduleTitle: 'First Schedule', markdownContent: ['Supplementary provisions relating to the proceedings of the Board.'] },
//       { id: 'sch2', schedule: 'sch2', scheduleNumber: 2, scheduleTitle: 'Second Schedule', markdownContent: ['Procedure of the Tax Appeal Tribunal.'] },
//       { id: 'sch3', schedule: 'sch3', scheduleNumber: 3, scheduleTitle: 'Third Schedule', markdownContent: ['Procedure of the Office of the Tax Ombud.'] }
//     ];
//   }

//   private static jrb_extractTitle(text: string): string {
//     const match = text.match(/JOINT\s+REVENUE\s+BOARD\s+(?:OF\s+NIGERIA\s*)?\(ESTABLISHMENT\)\s+ACT[,\s]*(\d{4})/i);
//     return match ? `Joint Revenue Board (Establishment) Act, ${match[1]}` : 'Joint Revenue Board (Establishment) Act, 2025';
//   }

//   private static jrb_extractActNumber(text: string): string {
//     const match = text.match(/ACT\s+NO\.?\s*(\d+)/i);
//     return match ? `No. ${match[1]}` : 'No. 3';
//   }

//   private static jrb_extractYear(text: string): number {
//     const match = text.match(/20\d{2}/);
//     return match ? parseInt(match[0]) : 2025;
//   }

//   private static jrb_extractDescription(text: string): string {
//     const match = text.match(/An\s+Act\s+to\s+establish\s+the\s+Joint\s+Revenue\s+Board[^;\.]+[;\.]/i);
//     return match ? match[0].trim() : 'An Act to establish the Joint Revenue Board, the Tax Appeal Tribunal and the Office of the Tax Ombud.';
//   }

//   // ========================================================================
//   // PETROLEUM INDUSTRY ACT PROCESSOR - COMPLETELY SEPARATE
//   // ========================================================================

//   private static processPetroleumIndustryAct(text: string, documentId: string): StructuredDocument {
//     console.log('=== PETROLEUM INDUSTRY ACT - DEDICATED PROCESSOR ===');
    
//     const normalizedText = text
//       .replace(/\r\n/g, '\n')
//       .replace(/\r/g, '\n')
//       .replace(/\u00A0/g, ' ')
//       .replace(/[—–]/g, '-')
//       .trim();

//     const contentStartIndex = this.pia_findContentStart(normalizedText);
//     let contentText = normalizedText;
//     if (contentStartIndex !== -1) {
//       contentText = normalizedText.substring(contentStartIndex);
//     }

//     const chapters = this.pia_parseChapters(contentText);
//     const schedules = this.pia_extractSchedules(normalizedText);

//     const title = this.pia_extractTitle(normalizedText);
//     const actNumber = this.pia_extractActNumber(normalizedText);
//     const year = this.pia_extractYear(normalizedText);
//     const commencementDate = this.pia_extractCommencementDate(normalizedText);
//     const description = this.pia_extractDescription();

//     return {
//       id: documentId,
//       title,
//       actNumber,
//       year,
//       commencementDate,
//       description,
//       chapters: chapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
//       schedules,
//       metadata: {
//         source: 'Federal Republic of Nigeria Official Gazette',
//         publisher: 'Federal Government Printer, Lagos, Nigeria',
//         pageRange: 'A121–A370',
//         format: 'markdown',
//         encoding: 'UTF-8'
//       }
//     };
//   }

//   private static pia_findContentStart(text: string): number {
//     const patterns = [
//       /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS/i,
//       /PETROLEUM\s+INDUSTRY\s+ACT,\s*2021[\s\S]*?CHAPTER\s+1/i
//     ];

//     for (const pattern of patterns) {
//       const match = text.match(pattern);
//       if (match && match.index !== undefined) return match.index;
//     }
//     return -1;
//   }

//   private static pia_parseChapters(text: string): Chapter[] {
//     const chapters: Chapter[] = [];
//     const chapterRegex = /CHAPTER\s+(\d+)[—\-]\s*([^\n]+)/gi;
//     const chapterMatches: Array<{ number: number, title: string, index: number }> = [];

//     let match;
//     while ((match = chapterRegex.exec(text)) !== null) {
//       if (match.index === undefined) continue;
//       chapterMatches.push({
//         number: parseInt(match[1]),
//         title: match[2].toUpperCase().trim(),
//         index: match.index
//       });
//     }

//     for (let i = 0; i < chapterMatches.length; i++) {
//       const current = chapterMatches[i];
//       let endIndex = text.length;
//       if (i + 1 < chapterMatches.length) endIndex = chapterMatches[i + 1].index;
//       else {
//         const scheduleStart = text.indexOf('FIRST SCHEDULE', current.index);
//         if (scheduleStart !== -1) endIndex = scheduleStart;
//       }

//       const chapterContent = text.substring(current.index, endIndex);
//       const parts = this.pia_extractParts(chapterContent, current.number);

//       chapters.push({
//         id: `ch${current.number}`,
//         chapter: `ch${current.number}`,
//         chapterNumber: current.number,
//         chapterTitle: current.title,
//         parts
//       });
//     }

//     return chapters;
//   }

//   private static pia_extractParts(content: string, chapterNumber: number): Part[] {
//     const parts: Part[] = [];
//     const partRegex = /PART\s+([IVXLCDM]+)[—\-]\s*([^\n]+)/gi;
//     const partMatches: Array<{ number: string, title: string, index: number }> = [];

//     let match;
//     while ((match = partRegex.exec(content)) !== null) {
//       if (match.index === undefined) continue;
//       partMatches.push({ number: match[1], title: match[2].toUpperCase().trim(), index: match.index });
//     }

//     if (partMatches.length === 0) {
//       parts.push({
//         id: `ch${chapterNumber}-pt1`,
//         part: `ch${chapterNumber}-pt1`,
//         partNumber: 1,
//         partTitle: 'PROVISIONS',
//         sections: this.pia_extractSections(content, chapterNumber, 1)
//       });
//       return parts;
//     }

//     for (let i = 0; i < partMatches.length; i++) {
//       const current = partMatches[i];
//       const nextIndex = i + 1 < partMatches.length ? partMatches[i + 1].index : content.length;
//       const partContent = content.substring(current.index, nextIndex);
      
//       parts.push({
//         id: `ch${chapterNumber}-pt${i + 1}`,
//         part: `ch${chapterNumber}-pt${i + 1}`,
//         partNumber: i + 1,
//         partTitle: current.title,
//         sections: this.pia_extractSections(partContent, chapterNumber, i + 1)
//       });
//     }
//     return parts;
//   }

//   private static pia_extractSections(content: string, chapterNumber: number, partNumber: number): Section[] {
//     const sections: Section[] = [];
//     const sectionRegex = /(?:^|\n)(\d{1,3})\.\s*([^\n]+)/g;
//     const matches: Array<{ number: number, title: string, index: number, fullMatch: string }> = [];

//     let match;
//     while ((match = sectionRegex.exec(content)) !== null) {
//       if (match.index === undefined) continue;
//       matches.push({
//         number: parseInt(match[1]),
//         title: match[2].trim(),
//         index: match.index,
//         fullMatch: match[0]
//       });
//     }

//     for (let i = 0; i < matches.length; i++) {
//       const current = matches[i];
//       const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
//       const sectionContent = content.substring(current.index + current.fullMatch.length, nextIndex);

//       sections.push({
//         id: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
//         section: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
//         sectionNumber: current.number,
//         sectionTitle: current.title,
//         markdownContent: sectionContent.trim() ? [sectionContent.trim()] : []
//       });
//     }
//     return sections;
//   }

//   private static pia_extractSchedules(text: string): Schedule[] {
//     return [
//       { id: 'sch1', schedule: 'sch1', scheduleNumber: 1, scheduleTitle: 'First Schedule', markdownContent: ['First Schedule content.'] },
//       { id: 'sch2', schedule: 'sch2', scheduleNumber: 2, scheduleTitle: 'Second Schedule', markdownContent: ['Second Schedule content.'] },
//       { id: 'sch3', schedule: 'sch3', scheduleNumber: 3, scheduleTitle: 'Third Schedule', markdownContent: ['Third Schedule content.'] },
//       { id: 'sch4', schedule: 'sch4', scheduleNumber: 4, scheduleTitle: 'Fourth Schedule', markdownContent: ['Fourth Schedule content.'] },
//       { id: 'sch5', schedule: 'sch5', scheduleNumber: 5, scheduleTitle: 'Fifth Schedule', markdownContent: ['Fifth Schedule content.'] }
//     ];
//   }

//   private static pia_extractTitle(text: string): string {
//     const match = text.match(/PETROLEUM\s+INDUSTRY\s+ACT[,\s]*(\d{4})/i);
//     return match ? `Petroleum Industry Act, ${match[1]}` : 'Petroleum Industry Act, 2021';
//   }

//   private static pia_extractActNumber(text: string): string {
//     const match = text.match(/ACT\s+No\.?\s*(\d+)/i);
//     return match ? `No. ${match[1]}` : 'No. 6';
//   }

//   private static pia_extractYear(text: string): number {
//     const match = text.match(/20\d{2}/);
//     return match ? parseInt(match[0]) : 2021;
//   }

//   private static pia_extractCommencementDate(text: string): string {
//     return '16th August, 2021';
//   }

//   private static pia_extractDescription(): string {
//     return 'An Act to provide legal, governance, regulatory and fiscal framework for the Nigerian petroleum industry and host communities.';
//   }

//   // ========================================================================
//   // PUBLIC HELPER METHODS
//   // ========================================================================

//   static generateTableOfContents(structuredDoc: StructuredDocument): any {
//     const toc: any = {
//       id: structuredDoc.id,
//       title: structuredDoc.title,
//       actNumber: structuredDoc.actNumber,
//       year: structuredDoc.year
//     };

//     if (structuredDoc.chapters && structuredDoc.chapters.length > 0) {
//       toc.chapters = structuredDoc.chapters.map(chapter => ({
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
//       }));
//     }

//     if (structuredDoc.parts && structuredDoc.parts.length > 0) {
//       toc.parts = structuredDoc.parts.map(part => ({
//         id: part.id,
//         partNumber: part.partNumber,
//         partTitle: part.partTitle,
//         sections: part.sections.map(section => ({
//           id: section.id,
//           sectionNumber: section.sectionNumber,
//           sectionTitle: section.sectionTitle
//         }))
//       }));
//     }

//     if (structuredDoc.schedules) {
//       toc.schedules = structuredDoc.schedules.map(schedule => ({
//         id: schedule.id,
//         scheduleNumber: schedule.scheduleNumber,
//         scheduleTitle: schedule.scheduleTitle
//       }));
//     }

//     return toc;
//   }

//   static getSectionById(structuredDoc: StructuredDocument, sectionId: string): Section | null {
//     if (structuredDoc.chapters) {
//       for (const chapter of structuredDoc.chapters) {
//         for (const part of chapter.parts) {
//           for (const section of part.sections) {
//             if (section.id === sectionId) return section;
//           }
//         }
//       }
//     }

//     if (structuredDoc.parts) {
//       for (const part of structuredDoc.parts) {
//         for (const section of part.sections) {
//           if (section.id === sectionId) return section;
//         }
//       }
//     }

//     return null;
//   }

//   static searchSections(structuredDoc: StructuredDocument, query: string): Section[] {
//     const results: Section[] = [];
//     const lowerQuery = query.toLowerCase();

//     if (structuredDoc.chapters) {
//       for (const chapter of structuredDoc.chapters) {
//         for (const part of chapter.parts) {
//           for (const section of part.sections) {
//             if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
//               results.push(section);
//               continue;
//             }
//             const contentText = section.markdownContent.join(' ').toLowerCase();
//             if (contentText.includes(lowerQuery)) results.push(section);
//           }
//         }
//       }
//     }

//     if (structuredDoc.parts) {
//       for (const part of structuredDoc.parts) {
//         for (const section of part.sections) {
//           if (section.sectionTitle.toLowerCase().includes(lowerQuery)) {
//             results.push(section);
//             continue;
//           }
//           const contentText = section.markdownContent.join(' ').toLowerCase();
//           if (contentText.includes(lowerQuery)) results.push(section);
//         }
//       }
//     }

//     return results;
//   }
// }