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
    console.log('Document filename:', originalFileName);
    console.log('Text length:', rawText.length);

    // Check if this is Nigeria Tax Act
    const isTaxAct = rawText.includes('NIGERIA TAX ACT') ||
      rawText.includes('AN ACT TO REPEAL THE CAPITAL GAINS TAX ACT') ||
      originalFileName.toUpperCase().includes('TAX') ||
      originalFileName.toUpperCase().includes('TAX-ACT');

    console.log('Is Tax Act?', isTaxAct);

    if (isTaxAct) {
      console.log('Processing Nigeria Tax Act document...');
      return this.processNigeriaTaxActBySections(rawText, documentId, originalFileName);
    }

    // For PIA documents - KEEP YOUR ORIGINAL IMPLEMENTATION
    console.log('Processing PIA document using original logic...');
    const contentStartIndex = this.findContentStartIndex(rawText, false);

    if (contentStartIndex === -1) {
      console.log('Could not find content start, using full text');
      return this.processFullDocument(rawText, documentId, originalFileName);
    }

    const contentText = rawText.substring(contentStartIndex);
    console.log('Content text starts at index:', contentStartIndex);
    console.log('Content text length:', contentText.length);

    return this.processFullDocument(contentText, documentId, originalFileName);
  }

  /**
   * Process Nigeria Tax Act by using SECTION NUMBERS to determine chapter boundaries
   */
  private static processNigeriaTaxActBySections(
    text: string,
    documentId: string,
    originalFileName: string
  ): StructuredDocument {
    console.log('Processing Nigeria Tax Act by section numbers...');

    // Normalize the text
    const normalizedText = this.normalizeText(text);

    // Define chapter boundaries based on section numbers
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

    // Find where the actual content starts (after table of contents)
    const contentStartIndex = this.findContentStartBySection1(normalizedText);
    let contentText = normalizedText;
    
    if (contentStartIndex !== -1) {
      contentText = normalizedText.substring(contentStartIndex);
      console.log(`Content starts at index ${contentStartIndex}`);
    }

    // CRITICAL: Find where schedules start and CUT OFF everything after that
    const scheduleStartIndex = contentText.indexOf('FIRST SCHEDULE');
    let chaptersText = contentText;
    
    if (scheduleStartIndex !== -1) {
      chaptersText = contentText.substring(0, scheduleStartIndex);
      console.log(`Cut chapters text at schedule start (index ${scheduleStartIndex})`);
    }

    // Extract chapters from the chapters text (without schedules)
    const chapters = this.splitDocumentBySections(chaptersText, chapterDefinitions);
    console.log(`Split document into ${chapters.length} chapters based on section numbers`);

    // Extract schedules from the ENTIRE document (not from chapters text)
    const schedules = this.extractAllSchedulesFromText(normalizedText);
    console.log(`Extracted ${schedules.length} schedules`);

    return {
      id: documentId,
      title: this.extractTitle(normalizedText, originalFileName),
      actNumber: this.extractActNumber(normalizedText),
      year: this.extractYear(normalizedText),
      commencementDate: this.extractCommencementDate(normalizedText),
      description: this.extractDescription(normalizedText),
      chapters: chapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
      schedules,
      metadata: this.extractMetadata(normalizedText)
    };
  }

  /**
   * Find where the content starts by looking for section 1
   */
  private static findContentStartBySection1(text: string): number {
    console.log('Finding content start by looking for section 1...');
    
    const patterns = [
      /\n\s*1\.\s+The\s+objective/i,
      /\n\s*1\.\s+Objective/i,
      /^1\.\s+The\s+objective/i,
      /^1\.\s+Objective/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        // Go backwards to find the chapter header if possible
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

  /**
   * Split the document into chapters based on section number ranges
   */
  private static splitDocumentBySections(
    text: string,
    chapterDefinitions: Array<{ number: number, title: string, startSection: number, endSection: number }>
  ): Chapter[] {
    const chapters: Chapter[] = [];

    console.log('Splitting document by section ranges...');

    // First, find all section markers with their positions
    const sectionPositions: Array<{ number: number, index: number }> = [];
    
    const sectionRegex = /(?:^|\n)(\d{1,3})\.(?:[—–-]?\s*)/g;
    let match;
    
    while ((match = sectionRegex.exec(text)) !== null) {
      if (match.index === undefined) continue;
      const sectionNumber = parseInt(match[1]);
      if (sectionNumber >= 1 && sectionNumber <= 202) {
        sectionPositions.push({
          number: sectionNumber,
          index: match.index
        });
      }
    }

    // Sort by position
    sectionPositions.sort((a, b) => a.index - b.index);

    console.log(`Found ${sectionPositions.length} section markers`);

    // For each chapter definition, extract the content between its start section and the next chapter's start section
    for (let i = 0; i < chapterDefinitions.length; i++) {
      const def = chapterDefinitions[i];
      
      // Find the position of the first section in this chapter
      const startSectionPos = sectionPositions.find(sp => sp.number === def.startSection);
      
      if (!startSectionPos) {
        console.log(`Could not find start section ${def.startSection} for Chapter ${def.number}, creating empty chapter`);
        const emptyChapter = this.createEmptyChapter(def.number, def.title);
        chapters.push(emptyChapter);
        continue;
      }

      // Find the end position (start of next chapter's first section)
      let endIndex = text.length;
      
      if (i + 1 < chapterDefinitions.length) {
        const nextChapterStartSection = chapterDefinitions[i + 1].startSection;
        const nextSectionPos = sectionPositions.find(sp => sp.number === nextChapterStartSection);
        if (nextSectionPos) {
          endIndex = nextSectionPos.index;
          console.log(`Chapter ${def.number} ends at next chapter's first section (${nextChapterStartSection}) at index ${endIndex}`);
        }
      }

      // Extract chapter content - EXACTLY from start section to next chapter's start section
      let chapterContent = text.substring(startSectionPos.index, endIndex).trim();

      // Extract chapter title
      let chapterTitle = def.title;
      
      // Look for CHAPTER header before the first section
      const textBeforeFirstSection = text.substring(0, startSectionPos.index);
      const lastChapterIndex = textBeforeFirstSection.lastIndexOf('CHAPTER');
      if (lastChapterIndex !== -1) {
        const chapterHeaderLine = textBeforeFirstSection.substring(lastChapterIndex, startSectionPos.index).split('\n')[0];
        const titleMatch = chapterHeaderLine.match(/[—–-]\s*([^\n]+)/i);
        if (titleMatch) {
          chapterTitle = titleMatch[1].trim().toUpperCase();
        }
      }

      console.log(`Processing Chapter ${def.number} (sections ${def.startSection}-${def.endSection}), content length: ${chapterContent.length}`);

      // Extract parts and sections from this chapter
      const parts = this.extractPartsFromChapterContent(
        chapterContent,
        def.number,
        def.startSection,
        def.endSection
      );

      chapters.push({
        id: `ch${def.number}`,
        chapter: `ch${def.number}`,
        chapterNumber: def.number,
        chapterTitle,
        parts
      });
    }

    return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  /**
   * Extract parts from chapter content
   */
  private static extractPartsFromChapterContent(
    content: string,
    chapterNumber: number,
    startSection: number,
    endSection: number
  ): Part[] {
    const parts: Part[] = [];

    if (!content.trim()) {
      return parts;
    }

    // Remove any stray chapter headers that might be in the content
    let cleanContent = content.replace(/^CHAPTER\s+(?:ONE|1|TWO|2|THREE|3|FOUR|4|FIVE|5|SIX|6|SEVEN|7|EIGHT|8|NINE|9|TEN|10)[—–-][^\n]*\n?/i, '');

    // Find all PART headers
    const partHeaders: Array<{ title: string, index: number, header: string }> = [];
    
    const partRegex = /PART\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X|1|2|3|4|5|6|7|8|9|10|ONE|TWO|THREE|FOUR|FIVE)[—–-][^\n]*/gi;
    let match;
    
    while ((match = partRegex.exec(cleanContent)) !== null) {
      if (match.index === undefined) continue;
      
      let partTitle = '';
      const titleMatch = match[0].match(/[—–-]\s*([^\n]+)/i);
      if (titleMatch) {
        partTitle = titleMatch[1].trim().toUpperCase();
      }
      
      partHeaders.push({
        title: partTitle,
        index: match.index,
        header: match[0]
      });
    }

    // Sort parts by position
    partHeaders.sort((a, b) => a.index - b.index);

    // If no parts found, treat whole chapter as one part
    if (partHeaders.length === 0) {
      const sections = this.extractSectionsByRange(
        cleanContent,
        chapterNumber,
        1,
        startSection,
        endSection
      );
      
      parts.push({
        id: `ch${chapterNumber}-pt1`,
        part: `ch${chapterNumber}-pt1`,
        partNumber: 1,
        partTitle: 'PROVISIONS',
        sections
      });
      
      return parts;
    }

    // Process each part
    for (let i = 0; i < partHeaders.length; i++) {
      const currentPart = partHeaders[i];
      
      // Determine part end index
      let partEndIndex = cleanContent.length;
      if (i + 1 < partHeaders.length) {
        partEndIndex = partHeaders[i + 1].index;
      }
      
      // Extract part content (after the header)
      const partContent = cleanContent.substring(
        currentPart.index + currentPart.header.length,
        partEndIndex
      ).trim();
      
      // Extract sections from this part
      const sections = this.extractSectionsByRange(
        partContent,
        chapterNumber,
        i + 1,
        startSection,
        endSection
      );
      
      parts.push({
        id: `ch${chapterNumber}-pt${i + 1}`,
        part: `ch${chapterNumber}-pt${i + 1}`,
        partNumber: i + 1,
        partTitle: currentPart.title || `PART ${i + 1}`,
        sections
      });
    }

    return parts;
  }

  /**
   * Extract sections from content by section number range
   */
  private static extractSectionsByRange(
    content: string,
    chapterNumber: number,
    partNumber: number,
    startSection: number,
    endSection: number
  ): Section[] {
    const sections: Section[] = [];

    if (!content.trim()) {
      return sections;
    }

    // Find all sections within the chapter's range
    const sectionRegex = /(?:^|\n)(\d{1,3})\.(?:[—–-]?\s*)?([^\n]*)/g;
    
    const sectionMatches: Array<{
      number: number,
      title: string,
      index: number,
      fullMatch: string
    }> = [];

    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      if (match.index === undefined) continue;

      const sectionNumber = parseInt(match[1]);

      // Only accept sections within this chapter's range
      if (sectionNumber < startSection || sectionNumber > endSection) {
        continue;
      }

      let sectionTitle = match[2].trim();
      sectionTitle = sectionTitle.replace(/^[—–.\s-]+/, '').replace(/[—–.\s-]+$/, '');

      sectionMatches.push({
        number: sectionNumber,
        title: sectionTitle,
        index: match.index,
        fullMatch: match[0]
      });
    }

    // Process each section
    for (let i = 0; i < sectionMatches.length; i++) {
      const current = sectionMatches[i];

      // Determine section end
      let sectionEnd = content.length;
      if (i + 1 < sectionMatches.length) {
        sectionEnd = sectionMatches[i + 1].index;
      }

      // Extract section content
      const sectionStart = current.index + current.fullMatch.length;
      let sectionContent = content.substring(sectionStart, sectionEnd).trim();

      // CRITICAL FIX: Extract numbered subsections (1), (2), (3) etc.
      // AND capture their content with ALL letter bullets and roman numerals
      const subsections = this.extractNumberedSubsectionsWithContent(
        sectionContent,
        chapterNumber,
        partNumber,
        current.number
      );

      // Clean main content - remove the numbered subsections
      let mainContent = sectionContent;
      
      // Find the position of the first numbered subsection
      const subsectionRegex = /\((\d+)\)/g;
      const firstSubMatch = subsectionRegex.exec(sectionContent);
      
      if (firstSubMatch && firstSubMatch.index !== undefined) {
        // Main content is everything BEFORE the first numbered subsection
        mainContent = sectionContent.substring(0, firstSubMatch.index).trim();
        
        // Also remove any standalone headers that appear before the first subsection
        mainContent = this.removeStandaloneHeaders(mainContent);
      }

      // Clean the main content
      mainContent = this.cleanSectionText(mainContent);

      // Create main section - ONLY if it has a title or content
      if (current.title || mainContent) {
        const mainSection: Section = {
          id: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
          section: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
          sectionNumber: current.number,
          sectionTitle: current.title || `Section ${current.number}`,
          markdownContent: mainContent ? [mainContent] : []
        };

        sections.push(mainSection);
      }

      // Add subsections with their FULL content
      for (const sub of subsections) {
        sections.push(sub);
      }
    }

    return sections.sort((a, b) => {
      if (a.sectionNumber !== b.sectionNumber) {
        return a.sectionNumber - b.sectionNumber;
      }
      const aIsSub = a.id.includes('-us');
      const bIsSub = b.id.includes('-us');
      if (aIsSub && !bIsSub) return 1;
      if (!aIsSub && bIsSub) return -1;
      return 0;
    });
  }

  /**
   * Remove standalone headers from content
   */
  private static removeStandaloneHeaders(text: string): string {
    if (!text) return '';
    
    let cleaned = text;
    
    const headersToRemove = [
      'Objective', 'Application', 'Imposition of tax',
      'Income, profits or gains chargeable to tax', 'Chargeability to tax',
      'Nigerian company', 'Nigerian divi- dends',
      'Profits of a company from certain dividends',
      'Partnership of companies', 'Resident individual',
      'Employment income', 'Benefits-in-kind',
      'Partnership of individuals', 'Settlements, trusts and estates',
      'Non-resident person', 'Nigerian dividends received by Non-Resident persons',
      'Deductions allowed', 'Deductions not allowed',
      'Unilateral relief of double taxation', 'Double taxation agreement',
      'Method of calculating relief to be allowed for double taxation',
      'Charge of duties', 'Manner of denoting duty',
      'Obligation to stamp', 'Admissible evidence',
      'Bill of exchange', 'Promissory Note',
      'Sale or purchase of options', 'Conveyance on sale',
      'Conveyance in consideration of a debt', 'Duty on transfer of mineral assets',
      'Provisions as to exchange', 'Leases',
      'Duty on share capital', 'Duty on loan capital',
      'Marketable security', 'Appraisements',
      'Duplicates and counterparts', 'Duty relating to one instrument covering multiple transactions',
      'Duty relating to multiple instruments covering same transaction',
      'Provisions on non-monetary consideration', 'Imposition of value added tax',
      'Charge of VAT', 'Taxable supplies',
      'Time of supply', 'Rate of VAT',
      'Value of taxable supplies', 'Value of imported goods',
      'Taxable supply of non-residents', 'Payment of VAT by taxable person',
      'VAT Invoice', 'Collection of VAT by taxable person',
      'Collection of VAT by persons other than the supplier',
      'Credit for input tax and remission of VAT', 'Business restructuring',
      'Fiscalisation of supplies for VAT', 'Imposition of surcharge',
      'Chargeable transaction and base for surcharge',
      'Administration of the surcharge', 'Exemption from surcharge',
      'Income tax exemption', 'Deductible donations',
      'Deduction for research and development', 'Priority sectors',
      'Eligibility for economic development incentive certificate',
      'Application for economic development incentive certificate',
      'Approval of application', 'Terms of economic development incentive certificate',
      'Addition of product to the economic development incentive certificate',
      'Application of economic development incentive certificate',
      'Production day and qualifying capital expenditure',
      'Cancellation of economic development incentive certificate',
      'Information', 'Publication of economic development incentive certificate',
      'Economic development tax credit', 'Economic development incentive period',
      'Books and records for priority products', 'Returns of profits',
      'Cancellation or discountenance of economic development tax credit',
      'Provisions for plantation industry', 'Exclusion from other reliefs and transition arrangements',
      'Interpretation', 'Exemption from stamp duties',
      'Exempt supplies', 'Taxable supplies chargeable at zero percent',
      'Exemption by order of the President', 'Business restructuring',
      'Artificial transactions', 'Transactions between related parties to be at arm\'s length',
      'Waivers or refund of liability or expenses', 'Supplemental',
      'Power to make regulations', 'Repeals',
      'Consequential amendments', 'Revocation and consequential amendment of subsidiary legislation',
      'Savings provisions', 'Exercise of powers, duties and obligations',
      'Conflict with other laws', 'General interpretation',
      'Citation'
    ];

    for (const header of headersToRemove) {
      // Remove header at the beginning of content
      const pattern = new RegExp(`^\\s*${header.replace(/\s+/g, '\\s+')}\\s*$`, 'gim');
      cleaned = cleaned.replace(pattern, '');
      
      // Remove header followed by newline
      const patternWithNewline = new RegExp(`^\\s*${header.replace(/\s+/g, '\\s+')}\\s*\\n`, 'gim');
      cleaned = cleaned.replace(patternWithNewline, '');
    }
    
    return cleaned.trim();
  }

  /**
   * Extract numbered subsections (1), (2), (3) with their FULL content
   * This is the CRITICAL FIX - captures ALL letter bullets and roman numerals
   */
  private static extractNumberedSubsectionsWithContent(
    content: string,
    chapterNumber: number,
    partNumber: number,
    sectionNumber: number
  ): Section[] {
    const subsections: Section[] = [];

    if (!content) return subsections;

    // Match numbered subsections like (1), (2), (3)
    const numberedSubsectionRegex = /\((\d+)\)(?:\s*[—–-]?\s*)?([^\n]*)/gi;

    let match;
    let counter = 1;

    // Find ALL numbered subsections and their positions
    const subsectionPositions: Array<{
      number: string,
      title: string,
      index: number,
      fullMatch: string,
      content: string
    }> = [];

    while ((match = numberedSubsectionRegex.exec(content)) !== null) {
      if (match.index === undefined) continue;

      const subNum = match[1];
      let subTitle = match[2].trim();
      subTitle = subTitle.replace(/\s+/g, ' ').trim();

      subsectionPositions.push({
        number: subNum,
        title: subTitle,
        index: match.index,
        fullMatch: match[0],
        content: ''
      });
    }

    // If no numbered subsections found, return empty array
    if (subsectionPositions.length === 0) {
      return subsections;
    }

    // Extract content for each subsection
    for (let i = 0; i < subsectionPositions.length; i++) {
      const current = subsectionPositions[i];
      
      // Determine where this subsection ends
      let endIndex = content.length;
      if (i + 1 < subsectionPositions.length) {
        endIndex = subsectionPositions[i + 1].index;
      }

      // Extract the FULL content for this subsection
      const subStart = current.index + current.fullMatch.length;
      let subContent = content.substring(subStart, endIndex).trim();

      // Clean the content but PRESERVE all letter bullets and roman numerals
      subContent = this.cleanSubsectionText(subContent);

      // Create the subsection with -us ID
      const subsection: Section = {
        id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${counter}`,
        section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${counter}`,
        sectionNumber: sectionNumber,
        sectionTitle: `(${current.number})${current.title ? ' ' + current.title : ''}`,
        markdownContent: subContent ? [subContent] : []
      };

      subsections.push(subsection);
      counter++;
    }

    return subsections;
  }

  /**
   * Clean section text
   */
  private static cleanSectionText(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // Remove page artifacts
    cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\d{1,3}\s*$/gm, '');

    // Remove standalone headers
    cleaned = this.removeStandaloneHeaders(cleaned);

    // Handle hyphenated words
    cleaned = cleaned.replace(/([a-zA-Z])-\s+([a-zA-Z])/g, '$1$2');
    cleaned = cleaned.replace(/([a-zA-Z])-\n([a-zA-Z])/g, '$1$2');
    cleaned = cleaned.replace(/([a-zA-Z])- ([a-zA-Z])/g, '$1$2');

    // Clean formatting
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/\s+\)/g, ')');
    cleaned = cleaned.replace(/\(\s+/g, '(');
    cleaned = cleaned.replace(/\s*,\s*/g, ', ');
    cleaned = cleaned.replace(/\s*;\s*/g, '; ');
    cleaned = cleaned.replace(/\s*:\s*/g, ': ');
    cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
    cleaned = cleaned.replace(/ {2,}/g, ' ');

    const lines = cleaned.split('\n');
    const filteredLines = lines
      .map(line => line.trim())
      .filter(line => {
        if (line.length === 0) return false;
        if (/^\d+$/.test(line)) return false;
        if (line.length < 3 && !/[a-zA-Z]/.test(line)) return false;
        return true;
      });

    return filteredLines.join('\n').trim();
  }

  /**
   * Clean subsection text but PRESERVE all letter bullets and roman numerals
   */
  private static cleanSubsectionText(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // Remove page artifacts
    cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\d{1,3}\s*$/gm, '');

    // Remove part headers that might appear
    cleaned = cleaned.replace(/PART\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X|1|2|3|4|5|ONE|TWO|THREE|FOUR|FIVE)[—–-][^\n]+\n/gi, '');

    // Handle hyphenated words
    cleaned = cleaned.replace(/([a-zA-Z])-\s+([a-zA-Z])/g, '$1$2');
    cleaned = cleaned.replace(/([a-zA-Z])-\n([a-zA-Z])/g, '$1$2');
    cleaned = cleaned.replace(/([a-zA-Z])- ([a-zA-Z])/g, '$1$2');

    // Clean up formatting
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/\s+\)/g, ')');
    cleaned = cleaned.replace(/\(\s+/g, '(');
    cleaned = cleaned.replace(/\s*,\s*/g, ', ');
    cleaned = cleaned.replace(/\s*;\s*/g, '; ');
    cleaned = cleaned.replace(/\s*:\s*/g, ': ');
    cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
    cleaned = cleaned.replace(/\s*-\s*/g, '-');
    cleaned = cleaned.replace(/\s*—\s*/g, '—');
    cleaned = cleaned.replace(/ {2,}/g, ' ');

    // Remove any empty lines at the beginning
    cleaned = cleaned.replace(/^\s+/, '');

    return cleaned;
  }

  /**
   * Create an empty chapter
   */
  private static createEmptyChapter(chapterNumber: number, title: string): Chapter {
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

  /**
   * Create Chapter 1 manually
   */
  private static createChapter1(): Chapter {
    const sections: Section[] = [
      {
        id: 'ch1-pt1-s1',
        section: 'ch1-pt1-s1',
        sectionNumber: 1,
        sectionTitle: 'The objective of this Act is to provide a unified fiscal legislation governing taxation in Nigeria.',
        markdownContent: []
      },
      {
        id: 'ch1-pt1-s2',
        section: 'ch1-pt1-s2',
        sectionNumber: 2,
        sectionTitle: 'This Act applies throughout Nigeria to any person required to comply with any provision of the tax laws whether personally or on behalf of another person.',
        markdownContent: [] // EMPTY - no stray content
      }
    ];

    const part: Part = {
      id: 'ch1-pt1',
      part: 'ch1-pt1',
      partNumber: 1,
      partTitle: 'OBJECTIVE AND APPLICATION',
      sections
    };

    return {
      id: 'ch1',
      chapter: 'ch1',
      chapterNumber: 1,
      chapterTitle: 'OBJECTIVE AND APPLICATION',
      parts: [part]
    };
  }

  /**
   * Extract ALL schedules from the Nigeria Tax Act
   */
  private static extractAllSchedulesFromText(text: string): Schedule[] {
    const schedules: Schedule[] = [];

    if (!text || !text.trim()) {
      console.log('No schedule text provided');
      return this.getPlaceholderSchedules();
    }

    console.log('Extracting all Nigeria Tax Act schedules...');

    // Find where schedules start
    const scheduleStartIndex = text.indexOf('FIRST SCHEDULE');
    if (scheduleStartIndex === -1) {
      console.log('No FIRST SCHEDULE found in document');
      return this.getPlaceholderSchedules();
    }

    const schedulesText = text.substring(scheduleStartIndex);
    
    // Define all schedules with their patterns
    const scheduleDefinitions = [
      { name: 'First', number: 1, pattern: /FIRST\s+SCHEDULE/i },
      { name: 'Second', number: 2, pattern: /SECOND\s+SCHEDULE/i },
      { name: 'Third', number: 3, pattern: /THIRD\s+SCHEDULE/i },
      { name: 'Fourth', number: 4, pattern: /FOURTH\s+SCHEDULE/i },
      { name: 'Fifth', number: 5, pattern: /FIFTH\s+SCHEDULE/i },
      { name: 'Sixth', number: 6, pattern: /SIXTH\s+SCHEDULE/i },
      { name: 'Seventh', number: 7, pattern: /SEVENTH\s+SCHEDULE/i },
      { name: 'Eighth', number: 8, pattern: /EIGHTH\s+SCHEDULE/i },
      { name: 'Ninth', number: 9, pattern: /NINTH\s+SCHEDULE/i },
      { name: 'Tenth', number: 10, pattern: /TENTH\s+SCHEDULE/i },
      { name: 'Eleventh', number: 11, pattern: /ELEVENTH\s+SCHEDULE/i },
      { name: 'Twelfth', number: 12, pattern: /TWELFTH\s+SCHEDULE/i },
      { name: 'Thirteenth', number: 13, pattern: /THIRTEENTH\s+SCHEDULE/i },
      { name: 'Fourteenth', number: 14, pattern: /FOURTEENTH\s+SCHEDULE/i }
    ];

    // Find all schedule positions
    const schedulePositions: Array<{ name: string, number: number, index: number }> = [];

    for (const def of scheduleDefinitions) {
      const match = schedulesText.match(def.pattern);
      if (match && match.index !== undefined) {
        schedulePositions.push({
          name: def.name,
          number: def.number,
          index: scheduleStartIndex + match.index
        });
        console.log(`Found ${def.name} Schedule at index ${scheduleStartIndex + match.index}`);
      }
    }

    // Sort schedules by their position
    schedulePositions.sort((a, b) => a.index - b.index);

    if (schedulePositions.length === 0) {
      console.log('No schedules found in document');
      return this.getPlaceholderSchedules();
    }

    // Extract each schedule's content
    for (let i = 0; i < schedulePositions.length; i++) {
      const currentSchedule = schedulePositions[i];
      
      // Determine the end of this schedule
      let scheduleEndIndex = text.length;
      if (i + 1 < schedulePositions.length) {
        scheduleEndIndex = schedulePositions[i + 1].index;
      }

      // Extract schedule content
      let scheduleContent = text.substring(currentSchedule.index, scheduleEndIndex).trim();

      // Remove the schedule header
      const headerPattern = new RegExp(`^${currentSchedule.name}\\s+SCHEDULE[^\\n]*\\n`, 'i');
      scheduleContent = scheduleContent.replace(headerPattern, '');
      
      // Also remove any "Sections X, Y, Z" line that might follow
      scheduleContent = scheduleContent.replace(/^Sections?[^\n]*\n/i, '');
      
      // Clean the content
      const cleanedContent = this.cleanScheduleContent(scheduleContent);
      
      schedules.push({
        id: `sch${currentSchedule.number}`,
        schedule: `sch${currentSchedule.number}`,
        scheduleNumber: currentSchedule.number,
        scheduleTitle: `${currentSchedule.name} Schedule`,
        markdownContent: [cleanedContent]
      });
      
      console.log(`Extracted ${currentSchedule.name} Schedule, content length: ${cleanedContent.length}`);
    }

    return schedules;
  }

  /**
   * Convert number to word form
   */
  private static numberToWords(num: number): string {
    const words = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
    return num >= 1 && num <= 10 ? words[num - 1] : num.toString();
  }

  // =============== PIA METHODS - KEEP YOUR ORIGINAL IMPLEMENTATION ===============

  private static findContentStartIndex(text: string, isTaxAct: boolean = false): number {
    console.log('Finding content start for document type:', isTaxAct ? 'Tax Act' : 'PIA');

    if (isTaxAct) {
      return -1;
    }

    const piaPatterns = [
      /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS\s+PART\s+I[—\-]\s*OBJECTIVES\s+AND\s+APPLICATION\s*\n\s*\d+\.\s+/i,
      /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS[^\n]*\n\s*\d+\.\s+The\s+property\s+and\s+ownership/i,
      /CHAPTER\s+1[—\-][\s\S]*?1\.\s+The\s+property\s+and\s+ownership/i,
      /PETROLEUM\s+INDUSTRY\s+ACT,\s*2021[\s\S]*?CHAPTER\s+1[—\-]/i,
    ];

    for (const pattern of piaPatterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        console.log(`Found PIA pattern at index: ${match.index}`);
        return match.index;
      }
    }

    return -1;
  }

  private static processFullDocument(
    text: string,
    documentId: string,
    originalFileName: string
  ): StructuredDocument {
    console.log('Processing PIA document...');
    const normalizedText = this.normalizeText(text);

    const result = {
      id: documentId,
      title: this.extractTitle(normalizedText, originalFileName),
      actNumber: this.extractActNumber(normalizedText),
      year: this.extractYear(normalizedText),
      commencementDate: this.extractCommencementDate(normalizedText),
      description: this.extractDescription(normalizedText),
      chapters: this.parsePIAStructure(normalizedText),
      schedules: this.extractPIASchedulesFromText(normalizedText),
      metadata: this.extractMetadata(normalizedText)
    };

    console.log('PIA document processing complete. Chapters found:', result.chapters.length);

    return result;
  }

  /**
   * Extract schedules from PIA documents - KEEP ORIGINAL IMPLEMENTATION
   */
  private static extractPIASchedulesFromText(text: string): Schedule[] {
    const schedules: Schedule[] = [];

    const schedulePatterns = [
      /FIRST SCHEDULE/i,
      /SCHEDULE\s+(?:ONE|1)/i,
      /\n\s*SCHEDULE/i
    ];

    let scheduleStartIndex = -1;
    for (const pattern of schedulePatterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        scheduleStartIndex = match.index;
        break;
      }
    }

    if (scheduleStartIndex === -1) {
      return this.getPlaceholderSchedules();
    }

    const scheduleText = text.substring(scheduleStartIndex);

    const schedulePatternsList = [
      { name: 'First', number: 1, regex: /(?:FIRST SCHEDULE|SCHEDULE\s+(?:ONE|1))([\s\S]*?)(?=SECOND SCHEDULE|SCHEDULE\s+(?:TWO|2)|$)/i },
      { name: 'Second', number: 2, regex: /(?:SECOND SCHEDULE|SCHEDULE\s+(?:TWO|2))([\s\S]*?)(?=THIRD SCHEDULE|SCHEDULE\s+(?:THREE|3)|$)/i },
      { name: 'Third', number: 3, regex: /(?:THIRD SCHEDULE|SCHEDULE\s+(?:THREE|3))([\s\S]*?)(?=FOURTH SCHEDULE|SCHEDULE\s+(?:FOUR|4)|$)/i },
      { name: 'Fourth', number: 4, regex: /(?:FOURTH SCHEDULE|SCHEDULE\s+(?:FOUR|4))([\s\S]*?)(?=FIFTH SCHEDULE|SCHEDULE\s+(?:FIVE|5)|$)/i },
      { name: 'Fifth', number: 5, regex: /(?:FIFTH SCHEDULE|SCHEDULE\s+(?:FIVE|5))([\s\S]*?)(?=$)/i }
    ];

    for (const pattern of schedulePatternsList) {
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

  private static parsePIAStructure(text: string): Chapter[] {
    const chapters: Chapter[] = [];

    const chapterRegex = /CHAPTER\s+(\d+)[—\-]\s*([^\n]+)/gi;
    const chapterMatches: Array<{ number: number, title: string, index: number }> = [];

    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
      if (match.index === undefined) continue;

      const chapterNumber = parseInt(match[1]);
      const chapterTitle = match[2].toUpperCase().trim();

      chapterMatches.push({
        number: chapterNumber,
        title: chapterTitle,
        index: match.index
      });
    }

    console.log(`Found ${chapterMatches.length} chapters in PIA text`);

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

      console.log(`Processing PIA Chapter ${currentChapter.number}: ${currentChapter.title}`);

      let cleanChapterContent = chapterContent;

      if (currentChapter.number === 3) {
        const chapter4Start = chapterContent.indexOf('CHAPTER 4');
        if (chapter4Start !== -1) {
          cleanChapterContent = chapterContent.substring(0, chapter4Start);
        }
      }

      if (currentChapter.number === 4) {
        const chapter5Start = chapterContent.indexOf('CHAPTER 5');
        if (chapter5Start !== -1) {
          cleanChapterContent = chapterContent.substring(0, chapter5Start);
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

    const chapterNumbers = chapters.map(ch => ch.chapterNumber);

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
      }
    }

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
      }
    }

    return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  private static extractPartsForChapter(chapterText: string, chapterNumber: number): Part[] {
    const parts: Part[] = [];

    let cleanChapterText = chapterText;

    if (chapterNumber < 10) {
      const nextChapterNum = chapterNumber + 1;
      const nextChapterPattern = new RegExp(`CHAPTER\\s+${nextChapterNum}`, 'i');
      const nextChapterMatch = cleanChapterText.match(nextChapterPattern);
      if (nextChapterMatch && nextChapterMatch.index !== undefined) {
        cleanChapterText = cleanChapterText.substring(0, nextChapterMatch.index);
      }
    }

    const scheduleStart = cleanChapterText.indexOf('FIRST SCHEDULE');
    if (scheduleStart !== -1) {
      cleanChapterText = cleanChapterText.substring(0, scheduleStart);
    }

    const schedulePatterns = [
      /SECOND SCHEDULE/i,
      /THIRD SCHEDULE/i,
      /FOURTH SCHEDULE/i,
      /FIFTH SCHEDULE/i,
      /SCHEDULE\s+(?:ONE|1|TWO|2|THREE|3|FOUR|4|FIVE|5)/i
    ];

    for (const pattern of schedulePatterns) {
      const scheduleMatch = cleanChapterText.match(pattern);
      if (scheduleMatch && scheduleMatch.index !== undefined) {
        cleanChapterText = cleanChapterText.substring(0, scheduleMatch.index);
        break;
      }
    }

    if (!cleanChapterText.trim()) {
      return parts;
    }

    const partRegex = /PART\s+([IVXLCDM]+)[—\-]\s*([^\n]+)/gi;
    const partMatches: Array<{ number: string, title: string, index: number }> = [];

    let partMatch;
    while ((partMatch = partRegex.exec(cleanChapterText)) !== null) {
      if (partMatch.index === undefined) continue;

      partMatches.push({
        number: partMatch[1],
        title: partMatch[2].toUpperCase().trim(),
        index: partMatch.index
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

  private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
    const sections: Section[] = [];

    if (!content.trim()) {
      return sections;
    }

    const mainSectionRegex = /(?:^|\n)(\d{1,3})\.\s*(?:[—\-]?\s*\(?\d+\)?[—\-]?\s*)?([^\n]*)/g;

    const allMatches: Array<{
      type: 'main-section' | 'subsection',
      number: number,
      title: string,
      index: number,
      rawText: string
    }> = [];

    let match;
    while ((match = mainSectionRegex.exec(content)) !== null) {
      if (match.index === undefined) continue;

      const sectionNumber = parseInt(match[1]);
      const sectionTitle = match[2].trim();

      if (sectionNumber < 1 || sectionNumber > 999) {
        continue;
      }

      if (sectionNumber < 10 && sectionTitle.length < 3) {
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

    for (let i = 0; i < allMatches.length; i++) {
      const currentMatch = allMatches[i];
      const nextMatchIndex = i + 1 < allMatches.length ? allMatches[i + 1].index : content.length;

      const sectionStart = currentMatch.index + currentMatch.rawText.length;
      const sectionContent = content.substring(sectionStart, nextMatchIndex);

      const sectionResults = this.processIndividualSection(
        currentMatch.number,
        currentMatch.title,
        sectionContent,
        chapterNumber,
        partNumber
      );

      sections.push(...sectionResults);
    }

    return sections.sort((a, b) => {
      const aMatch = a.id.match(/ch\d+-pt\d+-s(\d+)(?:-us(\d+))?/);
      const bMatch = b.id.match(/ch\d+-pt\d+-s(\d+)(?:-us(\d+))?/);

      if (!aMatch || !bMatch) return 0;

      const aMain = parseInt(aMatch[1]);
      const bMain = parseInt(bMatch[1]);
      const aSub = aMatch[2] ? parseInt(aMatch[2]) : 0;
      const bSub = bMatch[2] ? parseInt(bMatch[2]) : 0;

      if (aMain !== bMain) {
        return aMain - bMain;
      }

      return aSub - bSub;
    });
  }

  private static processIndividualSection(
    mainSectionNumber: number,
    mainSectionTitle: string,
    sectionContent: string,
    chapterNumber: number,
    partNumber: number
  ): Section[] {
    const sections: Section[] = [];

    const cleanedMainTitle = this.cleanText(mainSectionTitle);

    const mainSection: Section = {
      id: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}`,
      section: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}`,
      sectionNumber: mainSectionNumber,
      sectionTitle: cleanedMainTitle,
      markdownContent: []
    };

    const parsedContent = this.parseSectionContentWithSubsections(sectionContent);

    if (parsedContent.mainContent) {
      mainSection.markdownContent = [parsedContent.mainContent];
    }

    sections.push(mainSection);

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

  private static parseSectionContentWithSubsections(content: string): {
    mainContent: string;
    subsections: Array<{ number: number, title: string, content: string }>;
  } {
    const result = {
      mainContent: '',
      subsections: [] as Array<{ number: number, title: string, content: string }>
    };

    if (!content.trim()) {
      return result;
    }

    const subsectionPattern = /(?:^|\n)(?:\((\d+)\))(?:[—\-]?\s*)?([^\n]*)/g;
    const matches: Array<{ number: number, title: string, index: number, rawText: string }> = [];

    let match;
    while ((match = subsectionPattern.exec(content)) !== null) {
      if (match.index === undefined) continue;

      const number = parseInt(match[1]);
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
      result.mainContent = this.cleanSectionContent(content, true);
      return result;
    }

    const firstSubsectionIndex = matches[0].index;
    const contentBeforeFirstSub = content.substring(0, firstSubsectionIndex).trim();

    if (contentBeforeFirstSub) {
      result.mainContent = this.cleanSectionContent(contentBeforeFirstSub, true);
    }

    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatchIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;

      const subStart = currentMatch.index + currentMatch.rawText.length;
      const subContent = content.substring(subStart, nextMatchIndex).trim();

      const cleanedContent = this.cleanSectionContent(subContent, true);
      const cleanedTitle = this.cleanText(currentMatch.title);

      result.subsections.push({
        number: currentMatch.number,
        title: cleanedTitle,
        content: cleanedContent
      });
    }

    return result;
  }

  private static cleanSectionContent(content: string, extractAlphabetItems: boolean): string {
    if (!content.trim()) return '';

    let cleaned = content;

    cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\d{1,3}\s*$/gm, '');

    const lines = cleaned.split('\n');
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (!line) {
        if (i > 0 && i < lines.length - 1 && lines[i - 1].trim() && lines[i + 1].trim()) {
          processedLines.push('');
        }
        continue;
      }

      if (this.isPageArtifact(line)) {
        continue;
      }

      if (i > 0 && this.isContinuationLine(line, lines[i - 1])) {
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

    if (extractAlphabetItems) {
      cleaned = cleaned.replace(/\(([a-z])\)/g, '($1)');
      cleaned = cleaned.replace(/([a-z])\)/g, '($1)');
      cleaned = cleaned.replace(/\(([a-z])\./g, '($1)');
      cleaned = cleaned.replace(/([a-z])\./g, '($1)');
    }

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

  // =============== HELPER METHODS ===============

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

  private static cleanText(text: string): string {
    if (!text) return '';

    let cleaned = text.trim();

    cleaned = cleaned.replace(/^[—:\-\.\s]+/, '');
    cleaned = cleaned.replace(/[—:\-\.\s]+$/, '');

    if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned;
  }

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
        'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH',
        'NIGERIA TAX ACT', 'TAX ACT', 'INCOME TAX'
      ];

      if (commonHeaders.some(header => trimmed.includes(header))) {
        return true;
      }
    }

    return false;
  }

  private static cleanScheduleContent(content: string): string {
    if (!content.trim()) return 'No content available.';

    let cleaned = content;

    // Remove page artifacts
    cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    
    // Remove any remaining schedule headers
    cleaned = cleaned.replace(/^[A-Z\s]+SCHEDULE[^a-z]*/i, '');
    
    // Clean up formatting
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    
    // Trim each line
    const lines = cleaned.split('\n');
    const trimmedLines = lines
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    return trimmedLines.join('\n').trim();
  }

  private static getPlaceholderSchedules(): Schedule[] {
    const scheduleNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth',
      'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth'];

    return scheduleNames.map((name, index) => ({
      id: `sch${index + 1}`,
      schedule: `sch${index + 1}`,
      scheduleNumber: index + 1,
      scheduleTitle: `${name} Schedule`,
      markdownContent: [this.getScheduleDescription(name)]
    }));
  }

  private static normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[—–]/g, '-')
      .trim();
  }

  private static extractTitle(text: string, fileName: string): string {
    const taxActMatch = text.match(/NIGERIA\s+TAX\s+ACT[,\s]*(\d{4})/i);
    if (taxActMatch) {
      return `Nigeria Tax Act, ${taxActMatch[1] || '2025'}`;
    }

    const titleMatch = text.match(/PETROLEUM\s+INDUSTRY\s+ACT[,\s]*(\d{4})/i);
    return titleMatch ? `Petroleum Industry Act, ${titleMatch[1]}` :
      fileName.replace(/\.[^/.]+$/, "") || 'Legal Document';
  }

  private static extractActNumber(text: string): string {
    const taxActMatch = text.match(/ACT\s+NO\.?\s*(\d+)\s+OF\s+\d{4}/i) ||
      text.match(/NIGERIA\s+TAX\s+ACT[,\s]*(\d{4})/i);
    if (taxActMatch) {
      return `No. ${taxActMatch[1] || '7'}`;
    }

    const actMatch = text.match(/ACT\s+No\.?\s*(\d+)/i);
    return actMatch ? `No. ${actMatch[1]}` : 'No. 6';
  }

  private static extractYear(text: string): number {
    const taxYearMatch = text.match(/NIGERIA\s+TAX\s+ACT[,\s]*(\d{4})/i);
    if (taxYearMatch) {
      const year = parseInt(taxYearMatch[1]);
      if (!isNaN(year)) return year;
    }

    const yearInAct = text.match(/ACT\s+NO\.?\s*\d+\s+OF\s+(\d{4})/i);
    if (yearInAct) {
      const year = parseInt(yearInAct[1]);
      if (!isNaN(year)) return year;
    }

    const commencementMatch = text.match(/\[(\d{4})\]/);
    if (commencementMatch) {
      const year = parseInt(commencementMatch[1]);
      if (!isNaN(year)) return year;
    }

    const yearMatch = text.match(/(20\d{2})/);
    return yearMatch ? parseInt(yearMatch[1]) : 2021;
  }

  private static extractCommencementDate(text: string): string {
    const taxDateMatch = text.match(/\[(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s*,\s*\d{4})\]/i);
    if (taxDateMatch) {
      return taxDateMatch[1];
    }

    const dateMatch = text.match(/Commencement[^:]*:\s*(\d{4}-\d{2}-\d{2})/i);
    return dateMatch ? dateMatch[1] : '2021-08-16';
  }

  private static extractDescription(text: string): string {
    if (text.includes('NIGERIA TAX ACT') || text.includes('TAX ACT')) {
      return "An Act to repeal various tax laws and consolidate the legal frameworks relating to taxation in Nigeria, providing for taxation of income, transactions and instruments.";
    }

    return "An Act to provide legal, governance, regulatory and fiscal framework for the Nigerian petroleum industry and host communities.";
  }

  private static getScheduleDescription(name: string): string {
    const descriptions: { [key: string]: string } = {
      'First': 'Provisions relating to income tax rates and computations.',
      'Second': 'Value Added Tax (VAT) provisions and exemptions.',
      'Third': 'Stamp duties and transaction taxes.',
      'Fourth': 'Tax incentives and relief provisions.',
      'Fifth': 'Administrative procedures and compliance requirements.',
      'Sixth': 'Penalties and enforcement provisions.',
      'Seventh': 'Transitional and savings provisions.',
      'Eighth': 'Miscellaneous provisions and amendments.',
      'Ninth': 'Supplementary provisions.',
      'Tenth': 'Final provisions and commencement.',
      'Eleventh': 'Items on which tax is suspended.',
      'Twelfth': 'Determination of residence.',
      'Thirteenth': 'Exemption for agricultural business.',
      'Fourteenth': 'Defence and Security Infrastructure Fund.'
    };

    return descriptions[name] || `Provisions and regulations for the ${name} Schedule.`;
  }

  private static extractMetadata(text: string): DocumentMetadata {
    const isTaxAct = text.includes('NIGERIA TAX ACT') || text.includes('TAX ACT');

    return {
      source: isTaxAct ?
        'Federal Republic of Nigeria Official Gazette' :
        'Federal Republic of Nigeria Official Gazette',
      publisher: isTaxAct ?
        'Federal Government Printer, Abuja, Nigeria' :
        'Federal Government Printer, Lagos, Nigeria',
      pageRange: isTaxAct ? 'A1–A250' : 'A121–A370',
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
//     console.log('Document filename:', originalFileName);
//     console.log('Text length:', rawText.length);

//     // Check if this is Nigeria Tax Act
//     const isTaxAct = rawText.includes('NIGERIA TAX ACT') ||
//       rawText.includes('AN ACT TO REPEAL THE CAPITAL GAINS TAX ACT') ||
//       originalFileName.toUpperCase().includes('TAX') ||
//       originalFileName.toUpperCase().includes('TAX-ACT');

//     console.log('Is Tax Act?', isTaxAct);

//     if (isTaxAct) {
//       console.log('Processing Nigeria Tax Act document...');
//       return this.processNigeriaTaxActBySections(rawText, documentId, originalFileName);
//     }

//     // For PIA documents - KEEP YOUR ORIGINAL IMPLEMENTATION
//     console.log('Processing PIA document using original logic...');
//     const contentStartIndex = this.findContentStartIndex(rawText, false);

//     if (contentStartIndex === -1) {
//       console.log('Could not find content start, using full text');
//       return this.processFullDocument(rawText, documentId, originalFileName);
//     }

//     const contentText = rawText.substring(contentStartIndex);
//     console.log('Content text starts at index:', contentStartIndex);
//     console.log('Content text length:', contentText.length);

//     return this.processFullDocument(contentText, documentId, originalFileName);
//   }

//   /**
//    * Process Nigeria Tax Act by using SECTION NUMBERS to determine chapter boundaries
//    * This is more reliable than trying to parse "CHAPTER" headers
//    */
//   private static processNigeriaTaxActBySections(
//     text: string,
//     documentId: string,
//     originalFileName: string
//   ): StructuredDocument {
//     console.log('Processing Nigeria Tax Act by section numbers...');

//     // Normalize the text
//     const normalizedText = this.normalizeText(text);

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

//     // Find where the actual content starts (after table of contents)
//     const contentStartIndex = this.findContentStartBySection1(normalizedText);
//     const contentText = contentStartIndex !== -1 
//       ? normalizedText.substring(contentStartIndex)
//       : normalizedText;

//     // Split the document into chapters based on section numbers
//     const chapters = this.splitDocumentBySections(contentText, chapterDefinitions);
//     console.log(`Split document into ${chapters.length} chapters based on section numbers`);

//     // Extract schedules (everything after FIRST SCHEDULE)
//     const schedules = this.extractSchedulesFromText(normalizedText);

//     return {
//       id: documentId,
//       title: this.extractTitle(normalizedText, originalFileName),
//       actNumber: this.extractActNumber(normalizedText),
//       year: this.extractYear(normalizedText),
//       commencementDate: this.extractCommencementDate(normalizedText),
//       description: this.extractDescription(normalizedText),
//       chapters,
//       schedules,
//       metadata: this.extractMetadata(normalizedText)
//     };
//   }

//   /**
//    * Find where the content starts by looking for section 1
//    */
//   private static findContentStartBySection1(text: string): number {
//     console.log('Finding content start by looking for section 1...');
    
//     const patterns = [
//       /\n\s*1\.\s+The\s+objective/i,
//       /\n\s*1\.\s+Objective/i,
//       /^1\.\s+The\s+objective/i,
//       /^1\.\s+Objective/i
//     ];

//     for (const pattern of patterns) {
//       const match = text.match(pattern);
//       if (match && match.index !== undefined) {
//         // Go backwards to find the chapter header if possible
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

//   /**
//    * Split the document into chapters based on section number ranges
//    */
//   private static splitDocumentBySections(
//     text: string,
//     chapterDefinitions: Array<{ number: number, title: string, startSection: number, endSection: number }>
//   ): Chapter[] {
//     const chapters: Chapter[] = [];

//     console.log('Splitting document by section ranges...');

//     // First, find all section markers with their positions
//     const sectionPositions: Array<{ number: number, index: number }> = [];
    
//     const sectionRegex = /(?:^|\n)(\d{1,3})\.(?:[—–-]?\s*)/g;
//     let match;
    
//     while ((match = sectionRegex.exec(text)) !== null) {
//       if (match.index === undefined) continue;
//       const sectionNumber = parseInt(match[1]);
//       if (sectionNumber >= 1 && sectionNumber <= 202) {
//         sectionPositions.push({
//           number: sectionNumber,
//           index: match.index
//         });
//       }
//     }

//     // Sort by position
//     sectionPositions.sort((a, b) => a.index - b.index);

//     console.log(`Found ${sectionPositions.length} section markers`);

//     // For each chapter definition, extract the content between its start section and the next chapter's start section
//     for (let i = 0; i < chapterDefinitions.length; i++) {
//       const def = chapterDefinitions[i];
      
//       // Find the position of the first section in this chapter
//       const startSectionPos = sectionPositions.find(sp => sp.number === def.startSection);
      
//       if (!startSectionPos) {
//         console.log(`Could not find start section ${def.startSection} for Chapter ${def.number}, creating empty chapter`);
//         const emptyChapter = this.createEmptyChapter(def.number, def.title);
//         chapters.push(emptyChapter);
//         continue;
//       }

//       // Find the end position (start of next chapter's first section, or end of document)
//       let endIndex = text.length;
      
//       if (i + 1 < chapterDefinitions.length) {
//         const nextChapterStartSection = chapterDefinitions[i + 1].startSection;
//         const nextSectionPos = sectionPositions.find(sp => sp.number === nextChapterStartSection);
//         if (nextSectionPos) {
//           endIndex = nextSectionPos.index;
//         }
//       } else {
//         // Last chapter - look for schedules
//         const scheduleIndex = text.indexOf('FIRST SCHEDULE', startSectionPos.index);
//         if (scheduleIndex !== -1) {
//           endIndex = scheduleIndex;
//         }
//       }

//       // Extract chapter content
//       let chapterContent = text.substring(startSectionPos.index, endIndex).trim();

//       // Extract chapter title
//       let chapterTitle = def.title;
      
//       // Look for CHAPTER header before the first section
//       const textBeforeFirstSection = text.substring(0, startSectionPos.index);
//       const lastChapterIndex = textBeforeFirstSection.lastIndexOf('CHAPTER');
//       if (lastChapterIndex !== -1) {
//         const chapterHeaderLine = textBeforeFirstSection.substring(lastChapterIndex, startSectionPos.index).split('\n')[0];
//         const titleMatch = chapterHeaderLine.match(/[—–-]\s*([^\n]+)/i);
//         if (titleMatch) {
//           chapterTitle = titleMatch[1].trim().toUpperCase();
//         }
//       }

//       console.log(`Processing Chapter ${def.number} (sections ${def.startSection}-${def.endSection}), content length: ${chapterContent.length}`);

//       // Extract parts and sections from this chapter
//       const parts = this.extractPartsFromChapterContent(
//         chapterContent,
//         def.number,
//         def.startSection,
//         def.endSection
//       );

//       chapters.push({
//         id: `ch${def.number}`,
//         chapter: `ch${def.number}`,
//         chapterNumber: def.number,
//         chapterTitle,
//         parts
//       });
//     }

//     return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
//   }

//   /**
//    * Extract parts from chapter content
//    */
//   private static extractPartsFromChapterContent(
//     content: string,
//     chapterNumber: number,
//     startSection: number,
//     endSection: number
//   ): Part[] {
//     const parts: Part[] = [];

//     if (!content.trim()) {
//       return parts;
//     }

//     // Find all PART headers
//     const partHeaders: Array<{ title: string, index: number, header: string }> = [];
    
//     const partRegex = /PART\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X|1|2|3|4|5|6|7|8|9|10|ONE|TWO|THREE|FOUR|FIVE)[—–-][^\n]*/gi;
//     let match;
    
//     while ((match = partRegex.exec(content)) !== null) {
//       if (match.index === undefined) continue;
      
//       let partTitle = '';
//       const titleMatch = match[0].match(/[—–-]\s*([^\n]+)/i);
//       if (titleMatch) {
//         partTitle = titleMatch[1].trim().toUpperCase();
//       }
      
//       partHeaders.push({
//         title: partTitle,
//         index: match.index,
//         header: match[0]
//       });
//     }

//     // Sort parts by position
//     partHeaders.sort((a, b) => a.index - b.index);

//     // If no parts found, treat whole chapter as one part
//     if (partHeaders.length === 0) {
//       const sections = this.extractSectionsByRange(
//         content,
//         chapterNumber,
//         1,
//         startSection,
//         endSection
//       );
      
//       parts.push({
//         id: `ch${chapterNumber}-pt1`,
//         part: `ch${chapterNumber}-pt1`,
//         partNumber: 1,
//         partTitle: 'PROVISIONS',
//         sections
//       });
      
//       return parts;
//     }

//     // Process each part
//     for (let i = 0; i < partHeaders.length; i++) {
//       const currentPart = partHeaders[i];
      
//       // Determine part end index
//       let partEndIndex = content.length;
//       if (i + 1 < partHeaders.length) {
//         partEndIndex = partHeaders[i + 1].index;
//       }
      
//       // Extract part content (after the header)
//       const partContent = content.substring(
//         currentPart.index + currentPart.header.length,
//         partEndIndex
//       ).trim();
      
//       // Extract sections from this part
//       const sections = this.extractSectionsByRange(
//         partContent,
//         chapterNumber,
//         i + 1,
//         startSection,
//         endSection
//       );
      
//       parts.push({
//         id: `ch${chapterNumber}-pt${i + 1}`,
//         part: `ch${chapterNumber}-pt${i + 1}`,
//         partNumber: i + 1,
//         partTitle: currentPart.title || `PART ${i + 1}`,
//         sections
//       });
//     }

//     return parts;
//   }

//   /**
//    * Extract sections from content by section number range
//    * THIS REPLACES the overloaded extractSectionsFromContent
//    */
//   private static extractSectionsByRange(
//     content: string,
//     chapterNumber: number,
//     partNumber: number,
//     startSection: number,
//     endSection: number
//   ): Section[] {
//     const sections: Section[] = [];

//     if (!content.trim()) {
//       return sections;
//     }

//     // Find all sections within the chapter's range
//     const sectionRegex = /(?:^|\n)(\d{1,3})\.(?:[—–-]?\s*)?([^\n]*)/g;
    
//     const sectionMatches: Array<{
//       number: number,
//       title: string,
//       index: number,
//       fullMatch: string
//     }> = [];

//     let match;
//     while ((match = sectionRegex.exec(content)) !== null) {
//       if (match.index === undefined) continue;

//       const sectionNumber = parseInt(match[1]);

//       // Only accept sections within this chapter's range
//       if (sectionNumber < startSection || sectionNumber > endSection) {
//         continue;
//       }

//       let sectionTitle = match[2].trim();
//       sectionTitle = sectionTitle.replace(/^[—–.\s-]+/, '').replace(/[—–.\s-]+$/, '');

//       sectionMatches.push({
//         number: sectionNumber,
//         title: sectionTitle,
//         index: match.index,
//         fullMatch: match[0]
//       });
//     }

//     // Process each section
//     for (let i = 0; i < sectionMatches.length; i++) {
//       const current = sectionMatches[i];

//       // Determine section end
//       let sectionEnd = content.length;
//       if (i + 1 < sectionMatches.length) {
//         sectionEnd = sectionMatches[i + 1].index;
//       }

//       // Extract section content
//       const sectionStart = current.index + current.fullMatch.length;
//       let sectionContent = content.substring(sectionStart, sectionEnd).trim();

//       // Extract numbered subsections (1), (2), (3) etc.
//       const subsections = this.extractNumberedSubsections(
//         sectionContent,
//         chapterNumber,
//         partNumber,
//         current.number
//       );

//       // Clean main content - remove the numbered subsections
//       let mainContent = sectionContent;
//       const firstSubIndex = sectionContent.search(/\(\d+\)/);
//       if (firstSubIndex !== -1) {
//         mainContent = sectionContent.substring(0, firstSubIndex).trim();
//       }

//       // Clean the main content
//       mainContent = this.cleanSectionText(mainContent);

//       // Create main section
//       const mainSection: Section = {
//         id: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
//         section: `ch${chapterNumber}-pt${partNumber}-s${current.number}`,
//         sectionNumber: current.number,
//         sectionTitle: current.title || `Section ${current.number}`,
//         markdownContent: mainContent ? [mainContent] : []
//       };

//       sections.push(mainSection);

//       // Add subsections
//       for (const sub of subsections) {
//         sections.push(sub);
//       }
//     }

//     return sections.sort((a, b) => {
//       if (a.sectionNumber !== b.sectionNumber) {
//         return a.sectionNumber - b.sectionNumber;
//       }
//       const aIsSub = a.id.includes('-us');
//       const bIsSub = b.id.includes('-us');
//       if (aIsSub && !bIsSub) return 1;
//       if (!aIsSub && bIsSub) return -1;
//       return 0;
//     });
//   }

//   /**
//    * Extract numbered subsections (1), (2), (3) from content
//    */
//   private static extractNumberedSubsections(
//     content: string,
//     chapterNumber: number,
//     partNumber: number,
//     sectionNumber: number
//   ): Section[] {
//     const subsections: Section[] = [];

//     if (!content) return subsections;

//     const subsectionRegex = /\((\d+)\)(?:\s*[—–-]?\s*)?([^\n]*)/gi;
    
//     let match;
//     let counter = 1;

//     while ((match = subsectionRegex.exec(content)) !== null) {
//       if (match.index === undefined) continue;

//       const subNum = match[1];
//       let subTitle = match[2].trim();
//       subTitle = subTitle.replace(/\s+/g, ' ').trim();

//       // Find where this subsection ends
//       const nextSubIndex = content.indexOf('\n(', match.index + 1);
//       const subEnd = nextSubIndex !== -1 ? nextSubIndex : content.length;
      
//       const subStart = match.index + match[0].length;
//       let subContent = content.substring(subStart, subEnd).trim();
      
//       // Clean the content
//       subContent = this.cleanSubsectionText(subContent);

//       const subsection: Section = {
//         id: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${counter}`,
//         section: `ch${chapterNumber}-pt${partNumber}-s${sectionNumber}-us${counter}`,
//         sectionNumber: sectionNumber,
//         sectionTitle: `(${subNum})${subTitle ? ' ' + subTitle : ''}`,
//         markdownContent: subContent ? [subContent] : []
//       };

//       subsections.push(subsection);
//       counter++;
//     }

//     return subsections;
//   }

//   /**
//    * Clean section text
//    */
//   private static cleanSectionText(text: string): string {
//     if (!text) return '';

//     let cleaned = text;

//     // Remove page artifacts
//     cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^\s*\d{1,3}\s*$/gm, '');

//     // Remove standalone headers
//     const headersToRemove = [
//       'Objective', 'Application', 'Imposition of tax',
//       'Income, profits or gains chargeable to tax', 'Chargeability to tax',
//       'Nigerian company', 'Nigerian divi- dends',
//       'Profits of a company from certain dividends',
//       'Partnership of companies', 'Resident individual',
//       'Employment income', 'Benefits-in-kind',
//       'Partnership of individuals', 'Settlements, trusts and estates',
//       'Non-resident person', 'Nigerian dividends received by Non-Resident persons',
//       'Deductions allowed', 'Deductions not allowed'
//     ];

//     for (const header of headersToRemove) {
//       const pattern = new RegExp(`^\\s*${header.replace(/\s+/g, '\\s+')}\\s*$`, 'gim');
//       cleaned = cleaned.replace(pattern, '');
//     }

//     // Handle hyphenated words
//     cleaned = cleaned.replace(/([a-zA-Z])-\s+([a-zA-Z])/g, '$1$2');
//     cleaned = cleaned.replace(/([a-zA-Z])-\n([a-zA-Z])/g, '$1$2');

//     // Clean formatting
//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
//     cleaned = cleaned.replace(/\s+\)/g, ')');
//     cleaned = cleaned.replace(/\(\s+/g, '(');
//     cleaned = cleaned.replace(/\s*,\s*/g, ', ');
//     cleaned = cleaned.replace(/\s*;\s*/g, '; ');
//     cleaned = cleaned.replace(/\s*:\s*/g, ': ');
//     cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
//     cleaned = cleaned.replace(/ {2,}/g, ' ');

//     const lines = cleaned.split('\n');
//     const filteredLines = lines
//       .map(line => line.trim())
//       .filter(line => {
//         if (line.length === 0) return false;
//         if (/^\d+$/.test(line)) return false;
//         if (line.length < 3 && !/[a-zA-Z]/.test(line)) return false;
//         return true;
//       });

//     return filteredLines.join('\n').trim();
//   }

//   /**
//    * Clean subsection text
//    */
//   private static cleanSubsectionText(text: string): string {
//     if (!text) return '';

//     let cleaned = text;

//     // Remove page artifacts
//     cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^\s*\d{1,3}\s*$/gm, '');

//     // Handle hyphenated words
//     cleaned = cleaned.replace(/([a-zA-Z])-\s+([a-zA-Z])/g, '$1$2');
//     cleaned = cleaned.replace(/([a-zA-Z])-\n([a-zA-Z])/g, '$1$2');

//     // Clean formatting
//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
//     cleaned = cleaned.replace(/\s+\)/g, ')');
//     cleaned = cleaned.replace(/\(\s+/g, '(');
//     cleaned = cleaned.replace(/\s*,\s*/g, ', ');
//     cleaned = cleaned.replace(/\s*;\s*/g, '; ');
//     cleaned = cleaned.replace(/\s*:\s*/g, ': ');
//     cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
//     cleaned = cleaned.replace(/ {2,}/g, ' ');

//     return cleaned.trim();
//   }

//   /**
//    * Create an empty chapter
//    */
//   private static createEmptyChapter(chapterNumber: number, title: string): Chapter {
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

//   /**
//    * Create Chapter 1 manually
//    */
//   private static createChapter1(): Chapter {
//     const sections: Section[] = [
//       {
//         id: 'ch1-pt1-s1',
//         section: 'ch1-pt1-s1',
//         sectionNumber: 1,
//         sectionTitle: 'The objective of this Act is to provide a unified fiscal legislation governing taxation in Nigeria.',
//         markdownContent: []
//       },
//       {
//         id: 'ch1-pt1-s2',
//         section: 'ch1-pt1-s2',
//         sectionNumber: 2,
//         sectionTitle: 'This Act applies throughout Nigeria to any person required to comply with any provision of the tax laws whether personally or on behalf of another person.',
//         markdownContent: []
//       }
//     ];

//     const part: Part = {
//       id: 'ch1-pt1',
//       part: 'ch1-pt1',
//       partNumber: 1,
//       partTitle: 'OBJECTIVE AND APPLICATION',
//       sections
//     };

//     return {
//       id: 'ch1',
//       chapter: 'ch1',
//       chapterNumber: 1,
//       chapterTitle: 'OBJECTIVE AND APPLICATION',
//       parts: [part]
//     };
//   }

//   // =============== PIA METHODS - KEEP YOUR ORIGINAL IMPLEMENTATION ===============

//   private static findContentStartIndex(text: string, isTaxAct: boolean = false): number {
//     console.log('Finding content start for document type:', isTaxAct ? 'Tax Act' : 'PIA');

//     if (isTaxAct) {
//       return -1;
//     }

//     const piaPatterns = [
//       /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS\s+PART\s+I[—\-]\s*OBJECTIVES\s+AND\s+APPLICATION\s*\n\s*\d+\.\s+/i,
//       /CHAPTER\s+1[—\-]\s*GOVERNANCE\s+AND\s+INSTITUTIONS[^\n]*\n\s*\d+\.\s+The\s+property\s+and\s+ownership/i,
//       /CHAPTER\s+1[—\-][\s\S]*?1\.\s+The\s+property\s+and\s+ownership/i,
//       /PETROLEUM\s+INDUSTRY\s+ACT,\s*2021[\s\S]*?CHAPTER\s+1[—\-]/i,
//     ];

//     for (const pattern of piaPatterns) {
//       const match = text.match(pattern);
//       if (match && match.index !== undefined) {
//         console.log(`Found PIA pattern at index: ${match.index}`);
//         return match.index;
//       }
//     }

//     return -1;
//   }

//   private static processFullDocument(
//     text: string,
//     documentId: string,
//     originalFileName: string
//   ): StructuredDocument {
//     console.log('Processing PIA document...');
//     const normalizedText = this.normalizeText(text);

//     const result = {
//       id: documentId,
//       title: this.extractTitle(normalizedText, originalFileName),
//       actNumber: this.extractActNumber(normalizedText),
//       year: this.extractYear(normalizedText),
//       commencementDate: this.extractCommencementDate(normalizedText),
//       description: this.extractDescription(normalizedText),
//       chapters: this.parsePIAStructure(normalizedText),
//       schedules: this.extractSchedulesFromText(normalizedText),
//       metadata: this.extractMetadata(normalizedText)
//     };

//     console.log('PIA document processing complete. Chapters found:', result.chapters.length);

//     return result;
//   }

//   private static parsePIAStructure(text: string): Chapter[] {
//     const chapters: Chapter[] = [];

//     const chapterRegex = /CHAPTER\s+(\d+)[—\-]\s*([^\n]+)/gi;
//     const chapterMatches: Array<{ number: number, title: string, index: number }> = [];

//     let match;
//     while ((match = chapterRegex.exec(text)) !== null) {
//       if (match.index === undefined) continue;

//       const chapterNumber = parseInt(match[1]);
//       const chapterTitle = match[2].toUpperCase().trim();

//       chapterMatches.push({
//         number: chapterNumber,
//         title: chapterTitle,
//         index: match.index
//       });
//     }

//     console.log(`Found ${chapterMatches.length} chapters in PIA text`);

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

//       console.log(`Processing PIA Chapter ${currentChapter.number}: ${currentChapter.title}`);

//       let cleanChapterContent = chapterContent;

//       if (currentChapter.number === 3) {
//         const chapter4Start = chapterContent.indexOf('CHAPTER 4');
//         if (chapter4Start !== -1) {
//           cleanChapterContent = chapterContent.substring(0, chapter4Start);
//         }
//       }

//       if (currentChapter.number === 4) {
//         const chapter5Start = chapterContent.indexOf('CHAPTER 5');
//         if (chapter5Start !== -1) {
//           cleanChapterContent = chapterContent.substring(0, chapter5Start);
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

//     const chapterNumbers = chapters.map(ch => ch.chapterNumber);

//     if (!chapterNumbers.includes(4)) {
//       console.log('Adding missing Chapter 4...');
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
//       }
//     }

//     if (!chapterNumbers.includes(5)) {
//       console.log('Adding missing Chapter 5...');
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
//       }
//     }

//     return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
//   }

//   private static extractPartsForChapter(chapterText: string, chapterNumber: number): Part[] {
//     const parts: Part[] = [];

//     let cleanChapterText = chapterText;

//     if (chapterNumber < 10) {
//       const nextChapterNum = chapterNumber + 1;
//       const nextChapterPattern = new RegExp(`CHAPTER\\s+${nextChapterNum}`, 'i');
//       const nextChapterMatch = cleanChapterText.match(nextChapterPattern);
//       if (nextChapterMatch && nextChapterMatch.index !== undefined) {
//         cleanChapterText = cleanChapterText.substring(0, nextChapterMatch.index);
//       }
//     }

//     const scheduleStart = cleanChapterText.indexOf('FIRST SCHEDULE');
//     if (scheduleStart !== -1) {
//       cleanChapterText = cleanChapterText.substring(0, scheduleStart);
//     }

//     const schedulePatterns = [
//       /SECOND SCHEDULE/i,
//       /THIRD SCHEDULE/i,
//       /FOURTH SCHEDULE/i,
//       /FIFTH SCHEDULE/i,
//       /SCHEDULE\s+(?:ONE|1|TWO|2|THREE|3|FOUR|4|FIVE|5)/i
//     ];

//     for (const pattern of schedulePatterns) {
//       const scheduleMatch = cleanChapterText.match(pattern);
//       if (scheduleMatch && scheduleMatch.index !== undefined) {
//         cleanChapterText = cleanChapterText.substring(0, scheduleMatch.index);
//         break;
//       }
//     }

//     if (!cleanChapterText.trim()) {
//       return parts;
//     }

//     const partRegex = /PART\s+([IVXLCDM]+)[—\-]\s*([^\n]+)/gi;
//     const partMatches: Array<{ number: string, title: string, index: number }> = [];

//     let partMatch;
//     while ((partMatch = partRegex.exec(cleanChapterText)) !== null) {
//       if (partMatch.index === undefined) continue;

//       partMatches.push({
//         number: partMatch[1],
//         title: partMatch[2].toUpperCase().trim(),
//         index: partMatch.index
//       });
//     }

//     console.log(`  Chapter ${chapterNumber}: Found ${partMatches.length} parts`);

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

//   private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
//     const sections: Section[] = [];

//     if (!content.trim()) {
//       return sections;
//     }

//     const mainSectionRegex = /(?:^|\n)(\d{1,3})\.\s*(?:[—\-]?\s*\(?\d+\)?[—\-]?\s*)?([^\n]*)/g;

//     const allMatches: Array<{
//       type: 'main-section' | 'subsection',
//       number: number,
//       title: string,
//       index: number,
//       rawText: string
//     }> = [];

//     let match;
//     while ((match = mainSectionRegex.exec(content)) !== null) {
//       if (match.index === undefined) continue;

//       const sectionNumber = parseInt(match[1]);
//       const sectionTitle = match[2].trim();

//       if (sectionNumber < 1 || sectionNumber > 999) {
//         continue;
//       }

//       if (sectionNumber < 10 && sectionTitle.length < 3) {
//         continue;
//       }

//       allMatches.push({
//         type: 'main-section',
//         number: sectionNumber,
//         title: sectionTitle,
//         index: match.index,
//         rawText: match[0]
//       });
//     }

//     for (let i = 0; i < allMatches.length; i++) {
//       const currentMatch = allMatches[i];
//       const nextMatchIndex = i + 1 < allMatches.length ? allMatches[i + 1].index : content.length;

//       const sectionStart = currentMatch.index + currentMatch.rawText.length;
//       const sectionContent = content.substring(sectionStart, nextMatchIndex);

//       const sectionResults = this.processIndividualSection(
//         currentMatch.number,
//         currentMatch.title,
//         sectionContent,
//         chapterNumber,
//         partNumber
//       );

//       sections.push(...sectionResults);
//     }

//     return sections.sort((a, b) => {
//       const aMatch = a.id.match(/ch\d+-pt\d+-s(\d+)(?:-us(\d+))?/);
//       const bMatch = b.id.match(/ch\d+-pt\d+-s(\d+)(?:-us(\d+))?/);

//       if (!aMatch || !bMatch) return 0;

//       const aMain = parseInt(aMatch[1]);
//       const bMain = parseInt(bMatch[1]);
//       const aSub = aMatch[2] ? parseInt(aMatch[2]) : 0;
//       const bSub = bMatch[2] ? parseInt(bMatch[2]) : 0;

//       if (aMain !== bMain) {
//         return aMain - bMain;
//       }

//       return aSub - bSub;
//     });
//   }

//   private static processIndividualSection(
//     mainSectionNumber: number,
//     mainSectionTitle: string,
//     sectionContent: string,
//     chapterNumber: number,
//     partNumber: number
//   ): Section[] {
//     const sections: Section[] = [];

//     const cleanedMainTitle = this.cleanText(mainSectionTitle);

//     const mainSection: Section = {
//       id: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}`,
//       section: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}`,
//       sectionNumber: mainSectionNumber,
//       sectionTitle: cleanedMainTitle,
//       markdownContent: []
//     };

//     const parsedContent = this.parseSectionContentWithSubsections(sectionContent);

//     if (parsedContent.mainContent) {
//       mainSection.markdownContent = [parsedContent.mainContent];
//     }

//     sections.push(mainSection);

//     for (const sub of parsedContent.subsections) {
//       const subsection: Section = {
//         id: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}-us${sub.number}`,
//         section: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}-us${sub.number}`,
//         sectionNumber: mainSectionNumber,
//         sectionTitle: `(${sub.number})${sub.title ? ' ' + sub.title : ''}`,
//         markdownContent: sub.content ? [sub.content] : []
//       };
//       sections.push(subsection);
//     }

//     return sections;
//   }

//   private static parseSectionContentWithSubsections(content: string): {
//     mainContent: string;
//     subsections: Array<{ number: number, title: string, content: string }>;
//   } {
//     const result = {
//       mainContent: '',
//       subsections: [] as Array<{ number: number, title: string, content: string }>
//     };

//     if (!content.trim()) {
//       return result;
//     }

//     const subsectionPattern = /(?:^|\n)(?:\((\d+)\))(?:[—\-]?\s*)?([^\n]*)/g;
//     const matches: Array<{ number: number, title: string, index: number, rawText: string }> = [];

//     let match;
//     while ((match = subsectionPattern.exec(content)) !== null) {
//       if (match.index === undefined) continue;

//       const number = parseInt(match[1]);
//       if (number >= 1 && number <= 20) {
//         matches.push({
//           number: number,
//           title: match[2].trim(),
//           index: match.index,
//           rawText: match[0]
//         });
//       }
//     }

//     if (matches.length === 0) {
//       result.mainContent = this.cleanSectionContent(content, true);
//       return result;
//     }

//     const firstSubsectionIndex = matches[0].index;
//     const contentBeforeFirstSub = content.substring(0, firstSubsectionIndex).trim();

//     if (contentBeforeFirstSub) {
//       result.mainContent = this.cleanSectionContent(contentBeforeFirstSub, true);
//     }

//     for (let i = 0; i < matches.length; i++) {
//       const currentMatch = matches[i];
//       const nextMatchIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;

//       const subStart = currentMatch.index + currentMatch.rawText.length;
//       const subContent = content.substring(subStart, nextMatchIndex).trim();

//       const cleanedContent = this.cleanSectionContent(subContent, true);
//       const cleanedTitle = this.cleanText(currentMatch.title);

//       result.subsections.push({
//         number: currentMatch.number,
//         title: cleanedTitle,
//         content: cleanedContent
//       });
//     }

//     return result;
//   }

//   private static cleanSectionContent(content: string, extractAlphabetItems: boolean): string {
//     if (!content.trim()) return '';

//     let cleaned = content;

//     cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^\s*\d{1,3}\s*$/gm, '');

//     const lines = cleaned.split('\n');
//     const processedLines: string[] = [];

//     for (let i = 0; i < lines.length; i++) {
//       let line = lines[i].trim();

//       if (!line) {
//         if (i > 0 && i < lines.length - 1 && lines[i - 1].trim() && lines[i + 1].trim()) {
//           processedLines.push('');
//         }
//         continue;
//       }

//       if (this.isPageArtifact(line)) {
//         continue;
//       }

//       if (i > 0 && this.isContinuationLine(line, lines[i - 1])) {
//         if (processedLines.length > 0) {
//           const lastLine = processedLines[processedLines.length - 1];
//           if (lastLine.endsWith('-')) {
//             processedLines[processedLines.length - 1] = lastLine.slice(0, -1) + line;
//           } else {
//             processedLines[processedLines.length - 1] = lastLine + ' ' + line;
//           }
//           continue;
//         }
//       }

//       processedLines.push(line);
//     }

//     cleaned = processedLines.join('\n');

//     if (extractAlphabetItems) {
//       cleaned = cleaned.replace(/\(([a-z])\)/g, '($1)');
//       cleaned = cleaned.replace(/([a-z])\)/g, '($1)');
//       cleaned = cleaned.replace(/\(([a-z])\./g, '($1)');
//       cleaned = cleaned.replace(/([a-z])\./g, '($1)');
//     }

//     cleaned = cleaned.replace(/\s+\)/g, ')');
//     cleaned = cleaned.replace(/\(\s+/g, '(');
//     cleaned = cleaned.replace(/\s+;/g, ' ;');
//     cleaned = cleaned.replace(/;\s+/g, ' ; ');
//     cleaned = cleaned.replace(/\s+:/g, ' :');
//     cleaned = cleaned.replace(/:\s+/g, ' : ');
//     cleaned = cleaned.replace(/\s*,\s*/g, ', ');
//     cleaned = cleaned.replace(/\s*-\s*/g, '-');
//     cleaned = cleaned.replace(/\s*—\s*/g, '—');
//     cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
//     cleaned = cleaned.replace(/ {2,}/g, ' ');
//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

//     return cleaned.trim();
//   }

//   // =============== HELPER METHODS ===============

//   private static isContinuationLine(line: string, prevLine: string): boolean {
//     const prevTrimmed = prevLine.trim();
//     const lineTrimmed = line.trim();

//     const prevEndsIncomplete = prevTrimmed.endsWith(';') ||
//       prevTrimmed.endsWith(',') ||
//       prevTrimmed.endsWith('-') ||
//       prevTrimmed.endsWith('—');

//     const looksLikeSection = lineTrimmed.match(/^\d+\.\s/) || lineTrimmed.match(/^\(\d+\)/);

//     if (prevEndsIncomplete && looksLikeSection) {
//       const sectionMatch = lineTrimmed.match(/^(\d+)\.\s/) || lineTrimmed.match(/^\((\d+)\)/);
//       if (sectionMatch) {
//         const sectionNum = parseInt(sectionMatch[1]);
//         return sectionNum < 10;
//       }
//     }

//     return false;
//   }

//   private static cleanText(text: string): string {
//     if (!text) return '';

//     let cleaned = text.trim();

//     cleaned = cleaned.replace(/^[—:\-\.\s]+/, '');
//     cleaned = cleaned.replace(/[—:\-\.\s]+$/, '');

//     if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
//       cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
//     }

//     cleaned = cleaned.replace(/\s+/g, ' ');

//     return cleaned;
//   }

//   private static isPageArtifact(line: string): boolean {
//     const trimmed = line.trim();

//     if (/^[A-Z]\d{2,4}$/.test(trimmed)) return true;
//     if (/^\d{1,3}$/.test(trimmed)) return true;
//     if (trimmed.length < 3 && !trimmed.match(/[a-z0-9]/i)) return true;
//     if (/^[\.\-\s]+$/.test(trimmed)) return true;

//     if (/^[A-Z\s]{2,30}$/.test(trimmed)) {
//       const commonHeaders = [
//         'PETROLEUM INDUSTRY ACT', 'ACT NO', 'CHAPTER', 'PART', 'SCHEDULE',
//         'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH',
//         'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH',
//         'NIGERIA TAX ACT', 'TAX ACT', 'INCOME TAX'
//       ];

//       if (commonHeaders.some(header => trimmed.includes(header))) {
//         return true;
//       }
//     }

//     return false;
//   }

//   private static extractSchedulesFromText(text: string): Schedule[] {
//     const schedules: Schedule[] = [];

//     const schedulePatterns = [
//       /FIRST SCHEDULE/i,
//       /SCHEDULE\s+(?:ONE|1)/i,
//       /\n\s*SCHEDULE/i
//     ];

//     let scheduleStartIndex = -1;
//     for (const pattern of schedulePatterns) {
//       const match = text.match(pattern);
//       if (match && match.index !== undefined) {
//         scheduleStartIndex = match.index;
//         break;
//       }
//     }

//     if (scheduleStartIndex === -1) {
//       return this.getPlaceholderSchedules();
//     }

//     const scheduleText = text.substring(scheduleStartIndex);

//     const schedulePatternsList = [
//       { name: 'First', number: 1, regex: /(?:FIRST SCHEDULE|SCHEDULE\s+(?:ONE|1))([\s\S]*?)(?=SECOND SCHEDULE|SCHEDULE\s+(?:TWO|2)|$)/i },
//       { name: 'Second', number: 2, regex: /(?:SECOND SCHEDULE|SCHEDULE\s+(?:TWO|2))([\s\S]*?)(?=THIRD SCHEDULE|SCHEDULE\s+(?:THREE|3)|$)/i },
//       { name: 'Third', number: 3, regex: /(?:THIRD SCHEDULE|SCHEDULE\s+(?:THREE|3))([\s\S]*?)(?=FOURTH SCHEDULE|SCHEDULE\s+(?:FOUR|4)|$)/i },
//       { name: 'Fourth', number: 4, regex: /(?:FOURTH SCHEDULE|SCHEDULE\s+(?:FOUR|4))([\s\S]*?)(?=FIFTH SCHEDULE|SCHEDULE\s+(?:FIVE|5)|$)/i },
//       { name: 'Fifth', number: 5, regex: /(?:FIFTH SCHEDULE|SCHEDULE\s+(?:FIVE|5))([\s\S]*?)(?=$)/i }
//     ];

//     for (const pattern of schedulePatternsList) {
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

//   private static cleanScheduleContent(content: string): string {
//     if (!content.trim()) return 'No content available.';

//     let cleaned = content;

//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
//     cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^[A-Z\s]+SCHEDULE[^a-z]*/i, '');

//     return cleaned.trim();
//   }

//   private static getPlaceholderSchedules(): Schedule[] {
//     const scheduleNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth',
//       'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];

//     return scheduleNames.map((name, index) => ({
//       id: `sch${index + 1}`,
//       schedule: `sch${index + 1}`,
//       scheduleNumber: index + 1,
//       scheduleTitle: `${name} Schedule`,
//       markdownContent: [this.getScheduleDescription(name)]
//     }));
//   }

//   private static normalizeText(text: string): string {
//     return text
//       .replace(/\r\n/g, '\n')
//       .replace(/\r/g, '\n')
//       .replace(/\n{3,}/g, '\n\n')
//       .replace(/\u00A0/g, ' ')
//       .replace(/[—–]/g, '-')
//       .trim();
//   }

//   private static extractTitle(text: string, fileName: string): string {
//     const taxActMatch = text.match(/NIGERIA\s+TAX\s+ACT[,\s]*(\d{4})/i);
//     if (taxActMatch) {
//       return `Nigeria Tax Act, ${taxActMatch[1] || '2025'}`;
//     }

//     const titleMatch = text.match(/PETROLEUM\s+INDUSTRY\s+ACT[,\s]*(\d{4})/i);
//     return titleMatch ? `Petroleum Industry Act, ${titleMatch[1]}` :
//       fileName.replace(/\.[^/.]+$/, "") || 'Legal Document';
//   }

//   private static extractActNumber(text: string): string {
//     const taxActMatch = text.match(/ACT\s+NO\.?\s*(\d+)\s+OF\s+\d{4}/i) ||
//       text.match(/NIGERIA\s+TAX\s+ACT[,\s]*(\d{4})/i);
//     if (taxActMatch) {
//       return `No. ${taxActMatch[1] || '7'}`;
//     }

//     const actMatch = text.match(/ACT\s+No\.?\s*(\d+)/i);
//     return actMatch ? `No. ${actMatch[1]}` : 'No. 6';
//   }

//   private static extractYear(text: string): number {
//     const taxYearMatch = text.match(/NIGERIA\s+TAX\s+ACT[,\s]*(\d{4})/i);
//     if (taxYearMatch) {
//       const year = parseInt(taxYearMatch[1]);
//       if (!isNaN(year)) return year;
//     }

//     const yearInAct = text.match(/ACT\s+NO\.?\s*\d+\s+OF\s+(\d{4})/i);
//     if (yearInAct) {
//       const year = parseInt(yearInAct[1]);
//       if (!isNaN(year)) return year;
//     }

//     const commencementMatch = text.match(/\[(\d{4})\]/);
//     if (commencementMatch) {
//       const year = parseInt(commencementMatch[1]);
//       if (!isNaN(year)) return year;
//     }

//     const yearMatch = text.match(/(20\d{2})/);
//     return yearMatch ? parseInt(yearMatch[1]) : 2021;
//   }

//   private static extractCommencementDate(text: string): string {
//     const taxDateMatch = text.match(/\[(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s*,\s*\d{4})\]/i);
//     if (taxDateMatch) {
//       return taxDateMatch[1];
//     }

//     const dateMatch = text.match(/Commencement[^:]*:\s*(\d{4}-\d{2}-\d{2})/i);
//     return dateMatch ? dateMatch[1] : '2021-08-16';
//   }

//   private static extractDescription(text: string): string {
//     if (text.includes('NIGERIA TAX ACT') || text.includes('TAX ACT')) {
//       return "An Act to repeal various tax laws and consolidate the legal frameworks relating to taxation in Nigeria, providing for taxation of income, transactions and instruments.";
//     }

//     return "An Act to provide legal, governance, regulatory and fiscal framework for the Nigerian petroleum industry and host communities.";
//   }

//   private static getScheduleDescription(name: string): string {
//     const descriptions: { [key: string]: string } = {
//       'First': 'Provisions relating to income tax rates and computations.',
//       'Second': 'Value Added Tax (VAT) provisions and exemptions.',
//       'Third': 'Stamp duties and transaction taxes.',
//       'Fourth': 'Tax incentives and relief provisions.',
//       'Fifth': 'Administrative procedures and compliance requirements.',
//       'Sixth': 'Penalties and enforcement provisions.',
//       'Seventh': 'Transitional and savings provisions.',
//       'Eighth': 'Miscellaneous provisions and amendments.',
//       'Ninth': 'Supplementary provisions.',
//       'Tenth': 'Final provisions and commencement.'
//     };

//     return descriptions[name] || `Provisions and regulations for the ${name} Schedule.`;
//   }

//   private static extractMetadata(text: string): DocumentMetadata {
//     const isTaxAct = text.includes('NIGERIA TAX ACT') || text.includes('TAX ACT');

//     return {
//       source: isTaxAct ?
//         'Federal Republic of Nigeria Official Gazette' :
//         'Federal Republic of Nigeria Official Gazette',
//       publisher: isTaxAct ?
//         'Federal Government Printer, Abuja, Nigeria' :
//         'Federal Government Printer, Lagos, Nigeria',
//       pageRange: isTaxAct ? 'A1–A250' : 'A121–A370',
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
//    * Extract sections from content - COMPLETE SOLUTION FOR ALL SECTIONS
//    */
//   private static extractSectionsFromContent(content: string, chapterNumber: number, partNumber: number): Section[] {
//     const sections: Section[] = [];
    
//     if (!content.trim()) {
//       return sections;
//     }
    
//     // Find ALL main sections (numbers without brackets like 1., 2., 3., 66., etc.)
//     // FIXED: Changed regex to only match section numbers that are reasonable (1-999)
//     const mainSectionRegex = /(?:^|\n)(\d{1,3})\.\s*(?:[—\-]?\s*\(?\d+\)?[—\-]?\s*)?([^\n]*)/g;
    
//     const allMatches: Array<{
//       type: 'main-section' | 'subsection',
//       number: number,
//       title: string,
//       index: number,
//       rawText: string
//     }> = [];
    
//     // First pass: collect all matches
//     let match;
//     while ((match = mainSectionRegex.exec(content)) !== null) {
//       const sectionNumber = parseInt(match[1]);
//       const sectionTitle = match[2].trim();
      
//       // Only accept reasonable section numbers (1-999 for this act)
//       // The year 2021 might appear in the text, but shouldn't be a section number
//       if (sectionNumber < 1 || sectionNumber > 999) {
//         continue;
//       }
      
//       // Skip very small numbers that might be list items
//       if (sectionNumber < 10 && sectionTitle.length < 3) {
//         continue;
//       }
      
//       // Additional check: if the title contains "The regulations under subsection",
//       // it's likely continuation text, not a new section
//       if (sectionTitle.toLowerCase().includes('the regulations under subsection')) {
//         continue;
//       }
      
//       allMatches.push({
//         type: 'main-section',
//         number: sectionNumber,
//         title: sectionTitle,
//         index: match.index,
//         rawText: match[0]
//       });
//     }
    
//     // Process each main section
//     for (let i = 0; i < allMatches.length; i++) {
//       const currentMatch = allMatches[i];
//       const nextMatchIndex = i + 1 < allMatches.length ? allMatches[i + 1].index : content.length;
      
//       // Extract this section's full content
//       const sectionStart = currentMatch.index + currentMatch.rawText.length;
//       const sectionContent = content.substring(sectionStart, nextMatchIndex);
      
//       // Process this section to get main section and subsections
//       const sectionResults = this.processIndividualSection(
//         currentMatch.number,
//         currentMatch.title,
//         sectionContent,
//         chapterNumber,
//         partNumber
//       );
      
//       // Add all results (main section + subsections) to sections array
//       sections.push(...sectionResults);
//     }
    
//     // Sort sections properly
//     return sections.sort((a, b) => {
//       // Extract main section number and subsection number
//       const aMatch = a.id.match(/ch\d+-pt\d+-s(\d+)(?:-us(\d+))?/);
//       const bMatch = b.id.match(/ch\d+-pt\d+-s(\d+)(?:-us(\d+))?/);
      
//       if (!aMatch || !bMatch) return 0;
      
//       const aMain = parseInt(aMatch[1]);
//       const bMain = parseInt(bMatch[1]);
//       const aSub = aMatch[2] ? parseInt(aMatch[2]) : 0;
//       const bSub = bMatch[2] ? parseInt(bMatch[2]) : 0;
      
//       // First sort by main section number
//       if (aMain !== bMain) {
//         return aMain - bMain;
//       }
      
//       // Then by subsection number (0 for main sections, so they come first)
//       return aSub - bSub;
//     });
//   }

//   /**
//    * Process an individual section to extract main section and subsections
//    */
//   private static processIndividualSection(
//     mainSectionNumber: number,
//     mainSectionTitle: string,
//     sectionContent: string,
//     chapterNumber: number,
//     partNumber: number
//   ): Section[] {
//     const sections: Section[] = [];
    
//     // Clean the main section title
//     const cleanedMainTitle = this.cleanText(mainSectionTitle);
    
//     // Create the main section first
//     const mainSection: Section = {
//       id: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}`,
//       section: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}`,
//       sectionNumber: mainSectionNumber,
//       sectionTitle: cleanedMainTitle,
//       markdownContent: []
//     };
    
//     // Parse the section content to find subsections
//     const parsedContent = this.parseSectionContentWithSubsections(sectionContent);
    
//     // Add main section content
//     if (parsedContent.mainContent) {
//       mainSection.markdownContent = [parsedContent.mainContent];
//     }
    
//     sections.push(mainSection);
    
//     // Add subsections if any
//     for (const sub of parsedContent.subsections) {
//       const subsection: Section = {
//         id: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}-us${sub.number}`,
//         section: `ch${chapterNumber}-pt${partNumber}-s${mainSectionNumber}-us${sub.number}`,
//         sectionNumber: mainSectionNumber,
//         sectionTitle: `(${sub.number})${sub.title ? ' ' + sub.title : ''}`,
//         markdownContent: sub.content ? [sub.content] : []
//       };
//       sections.push(subsection);
//     }
    
//     return sections;
//   }

//   /**
//    * Parse section content to identify main content and subsections
//    */
//   private static parseSectionContentWithSubsections(content: string): {
//     mainContent: string;
//     subsections: Array<{number: number, title: string, content: string}>;
//   } {
//     const result = {
//       mainContent: '',
//       subsections: [] as Array<{number: number, title: string, content: string}>
//     };
    
//     if (!content.trim()) {
//       return result;
//     }
    
//     // Find all potential subsection markers
//     const subsectionPattern = /(?:^|\n)(?:\((\d+)\))(?:[—\-]?\s*)?([^\n]*)/g;
//     const matches: Array<{number: number, title: string, index: number, rawText: string}> = [];
    
//     let match;
//     while ((match = subsectionPattern.exec(content)) !== null) {
//       const number = parseInt(match[1]);
//       // Only accept reasonable subsection numbers (1-20)
//       if (number >= 1 && number <= 20) {
//         matches.push({
//           number: number,
//           title: match[2].trim(),
//           index: match.index,
//           rawText: match[0]
//         });
//       }
//     }
    
//     if (matches.length === 0) {
//       // No subsections found
//       result.mainContent = this.cleanSectionContent(content, true);
//       return result;
//     }
    
//     // Extract content before first subsection
//     const firstSubsectionIndex = matches[0].index;
//     const contentBeforeFirstSub = content.substring(0, firstSubsectionIndex).trim();
    
//     if (contentBeforeFirstSub) {
//       result.mainContent = this.cleanSectionContent(contentBeforeFirstSub, true);
//     }
    
//     // Process each subsection
//     for (let i = 0; i < matches.length; i++) {
//       const currentMatch = matches[i];
//       const nextMatchIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
      
//       // Extract subsection content
//       const subStart = currentMatch.index + currentMatch.rawText.length;
//       const subContent = content.substring(subStart, nextMatchIndex).trim();
      
//       // Clean the content
//       const cleanedContent = this.cleanSectionContent(subContent, true);
      
//       // Clean the title
//       const cleanedTitle = this.cleanText(currentMatch.title);
      
//       result.subsections.push({
//         number: currentMatch.number,
//         title: cleanedTitle,
//         content: cleanedContent
//       });
//     }
    
//     return result;
//   }

//   /**
//    * Clean section content
//    */
//   private static cleanSectionContent(content: string, extractAlphabetItems: boolean): string {
//     if (!content.trim()) return '';
    
//     let cleaned = content;
    
//     // Remove page artifacts
//     cleaned = cleaned.replace(/^[A-Z]\d+\s*$/gm, '');
//     cleaned = cleaned.replace(/^\s*\d{1,3}\s*$/gm, '');
    
//     // Handle page continuation
//     const lines = cleaned.split('\n');
//     const processedLines: string[] = [];
    
//     for (let i = 0; i < lines.length; i++) {
//       let line = lines[i].trim();
      
//       if (!line) {
//         if (i > 0 && i < lines.length - 1 && lines[i-1].trim() && lines[i+1].trim()) {
//           processedLines.push('');
//         }
//         continue;
//       }
      
//       // Skip page artifacts
//       if (this.isPageArtifact(line)) {
//         continue;
//       }
      
//       // Handle page continuation
//       if (i > 0 && this.isContinuationLine(line, lines[i-1])) {
//         if (processedLines.length > 0) {
//           const lastLine = processedLines[processedLines.length - 1];
//           if (lastLine.endsWith('-')) {
//             processedLines[processedLines.length - 1] = lastLine.slice(0, -1) + line;
//           } else {
//             processedLines[processedLines.length - 1] = lastLine + ' ' + line;
//           }
//           continue;
//         }
//       }
      
//       processedLines.push(line);
//     }
    
//     cleaned = processedLines.join('\n');
    
//     // Format alphabet items consistently if needed
//     if (extractAlphabetItems) {
//       cleaned = cleaned.replace(/\(([a-z])\)/g, '($1)');
//       cleaned = cleaned.replace(/([a-z])\)/g, '($1)');
//       cleaned = cleaned.replace(/\(([a-z])\./g, '($1)');
//       cleaned = cleaned.replace(/([a-z])\./g, '($1)');
//     }
    
//     // Clean formatting
//     cleaned = cleaned.replace(/\s+\)/g, ')');
//     cleaned = cleaned.replace(/\(\s+/g, '(');
//     cleaned = cleaned.replace(/\s+;/g, ' ;');
//     cleaned = cleaned.replace(/;\s+/g, ' ; ');
//     cleaned = cleaned.replace(/\s+:/g, ' :');
//     cleaned = cleaned.replace(/:\s+/g, ' : ');
//     cleaned = cleaned.replace(/\s*,\s*/g, ', ');
//     cleaned = cleaned.replace(/\s*-\s*/g, '-');
//     cleaned = cleaned.replace(/\s*—\s*/g, '—');
//     cleaned = cleaned.replace(/\s*\.\s*/g, '. ');
//     cleaned = cleaned.replace(/ {2,}/g, ' ');
//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
//     return cleaned.trim();
//   }

//   /**
//    * Check if line is continuation from previous page
//    */
//   private static isContinuationLine(line: string, prevLine: string): boolean {
//     const prevTrimmed = prevLine.trim();
//     const lineTrimmed = line.trim();
    
//     const prevEndsIncomplete = prevTrimmed.endsWith(';') || 
//                               prevTrimmed.endsWith(',') || 
//                               prevTrimmed.endsWith('-') ||
//                               prevTrimmed.endsWith('—');
    
//     const looksLikeSection = lineTrimmed.match(/^\d+\.\s/) || lineTrimmed.match(/^\(\d+\)/);
    
//     if (prevEndsIncomplete && looksLikeSection) {
//       const sectionMatch = lineTrimmed.match(/^(\d+)\.\s/) || lineTrimmed.match(/^\((\d+)\)/);
//       if (sectionMatch) {
//         const sectionNum = parseInt(sectionMatch[1]);
//         return sectionNum < 10;
//       }
//     }
    
//     return false;
//   }

//   /**
//    * Clean text (for titles)
//    */
//   private static cleanText(text: string): string {
//     if (!text) return '';
    
//     let cleaned = text;
    
//     cleaned = cleaned.replace(/^[—:\-\.\s]+/, '');
//     cleaned = cleaned.replace(/[—:\-\.\s]+$/, '');
    
//     if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
//       cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
//     }
    
//     return cleaned.trim();
//   }

//   /**
//    * Check if line is a page artifact
//    */
//   private static isPageArtifact(line: string): boolean {
//     const trimmed = line.trim();
    
//     if (/^[A-Z]\d{2,4}$/.test(trimmed)) return true;
//     if (/^\d{1,3}$/.test(trimmed)) return true;
//     if (trimmed.length < 3 && !trimmed.match(/[a-z0-9]/i)) return true;
//     if (/^[\.\-\s]+$/.test(trimmed)) return true;
    
//     if (/^[A-Z\s]{2,30}$/.test(trimmed)) {
//       const commonHeaders = [
//         'PETROLEUM INDUSTRY ACT', 'ACT NO', 'CHAPTER', 'PART', 'SCHEDULE',
//         'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH',
//         'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH'
//       ];
      
//       if (commonHeaders.some(header => trimmed.includes(header))) {
//         return true;
//       }
//     }
    
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