import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { BadRequestError } from '../errors/BadRequestError';
import { OpenAI } from 'openai';
import { extractTextFromFile } from '../utils/fileExtractors';
import { TextProcessor } from '../utils/textProcessor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ComplianceFinding {
  category: string;
  provision: string;
  complianceStatus: 'compliant' | 'partial' | 'non_compliant' | 'missing';
  piaReference: string;
  analysis: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface ComplianceResult {
  compliant: boolean;
  analysis: string;
  piaReference: string;
  severity: 'high' | 'medium' | 'low';
}

interface ComplianceRequirement {
  category: string;
  description: string;
  piaKeywords: string[];
  userKeywords: string[];
  weight: number;
  checkCompliance: (userDoc: string, piaChunks: any[]) => ComplianceResult | null;
}

interface RiskAssessment {
  highRiskIssues: number;
  mediumRiskIssues: number;
  lowRiskIssues: number;
  overallRisk: 'high' | 'medium' | 'low';
}

interface AnalysisOverview {
  complianceScore: number;
  summary: string;
  totalProvisionsAnalyzed: number;
  majorComplianceAreas: string[];
  analysisMethod?: string;
}

interface Recommendations {
  immediateActions: string[];
  priorityAreas: string[];
  complianceTimeline: 'immediate_action_required' | 'short_term' | 'long_term';
  allRecommendations: string[];
}

interface ComplianceAnalysis {
  overview: AnalysisOverview;
  detailedFindings: ComplianceFinding[];
  riskAssessment: RiskAssessment;
  recommendations: Recommendations;
}

interface AIAnalysisResponse {
  overview: {
    complianceScore: number;
    summary: string;
    totalProvisionsAnalyzed: number;
    majorComplianceAreas: string[];
  };
  detailedFindings: ComplianceFinding[];
  riskAssessment: RiskAssessment;
  recommendations: Recommendations;
}



export const compareWithPIADocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('=== STARTING DOCUMENT COMPARISON ===');

    if (!req.file) {
      return next(new BadRequestError('No file uploaded'));
    }

    const userId = (req.user as any).id;

    // Get the latest PIA document from database
    const piaDocument = await prisma.document.findFirst({
      where: { 
        OR: [
          { title: { contains: 'Petroleum Industry Act', mode: 'insensitive' } },
          { title: { contains: 'PIA', mode: 'insensitive' } }
        ]
      },
      orderBy: { uploadedAt: 'desc' },
      include: {
        chunks: {
          select: {
            id: true,
            chapter: true,
            content: true,
            pageNumber: true
          }
        }
      }
    });

    if (!piaDocument) {
      throw new NotFoundError('PIA document not found in database. Please contact administrator.');
    }

    // Extract text from uploaded document
    let extractedData;
    try {
      extractedData = await extractTextFromFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      console.log('✅ User document text extraction successful');
      
      // Check if document is empty or has very little content
      if (!extractedData.text || extractedData.text.trim().length < 30) {
        return next(new BadRequestError('Document appears to be empty or contains insufficient content for analysis. Minimum 30 characters required.'));
      }
      
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      console.error('❌ Text extraction failed:', errorMessage);
      return next(new BadRequestError(`Failed to process file: ${errorMessage}`));
    }

    // Process and clean the uploaded document text
    const processedUserContent = TextProcessor.processRawText(
      extractedData.text,
      req.file.originalname
    );

    // Remove introduction and focus on legal content
    const legalContent = extractLegalContent(processedUserContent.rawText);

    // Check if legal content is sufficient
    if (legalContent.trim().length < 50) {
      return next(new BadRequestError('Document does not contain substantial legal content for analysis. Please upload a complete legal document.'));
    }

    // Compare with PIA document - try AI first, then fallback
    let comparisonResult;
    let analysisMethod = 'ai_analysis';
    
    try {
      console.log('🤖 Attempting AI-powered analysis...');
      comparisonResult = await compareDocumentsWithAI(
        legalContent,
        piaDocument,
        req.file.originalname
      );
      console.log('✅ AI analysis completed successfully');
    } catch (aiError: any) {
      console.log('🔄 AI analysis failed, using local fallback:', aiError.message);
      analysisMethod = 'local_analysis';
      comparisonResult = performLocalComplianceAnalysis(legalContent, piaDocument, req.file.originalname);
      console.log('✅ Local analysis completed successfully');
    }

    // Store comparison result in database
    const comparisonRecord = await prisma.searchHistory.create({
      data: {
        query: `Compliance Check: ${req.file.originalname} (${analysisMethod})`,
        results: comparisonResult,
        documentId: piaDocument.id,
        userId: userId,
      },
    });

    sendSuccessResponse(
      res,
      'Compliance analysis completed successfully',
      {
        analysis: {
          ...comparisonResult,
          analysisMethod: analysisMethod,
          analysisTimestamp: new Date().toISOString()
        },
        metadata: {
          userDocument: {
            filename: req.file.originalname,
            totalSections: processedUserContent.metadata?.sectionCount || 0,
            wordCount: extractedData.text.split(/\s+/).filter(w => w.length > 0).length,
            analyzedContentLength: legalContent.length
          },
          piaDocument: {
            title: piaDocument.title,
            reference: 'Petroleum Industry Act, 2021',
            chunksAnalyzed: piaDocument.chunks.length
          }
        },
        comparisonId: comparisonRecord.id
      }
    );
  } catch (error) {
    console.error('❌ Comparison error:', error);
    next(error);
  }
};

/**
 * Extract legal content by removing introductions
 */
const extractLegalContent = (text: string): string => {
  if (!text || text.trim().length === 0) {
    return '';
  }

  const introductionPatterns = [
    /introduction[\s\S]{1,2000}?(?=chapter|section|part|article)/gi,
    /preamble[\s\S]{1,2000}?(?=chapter|section|part|article)/gi,
    /preface[\s\S]{1,2000}?(?=chapter|section|part|article)/gi,
    /background[\s\S]{1,2000}?(?=chapter|section|part|article)/gi,
    /^[\s\S]{0,3000}?(?=CHAPTER|PART|SECTION|ARTICLE)/i,
    /executive summary[\s\S]{1,2000}?(?=chapter|section|part|article)/gi
  ];

  let legalText = text;
  introductionPatterns.forEach(pattern => {
    legalText = legalText.replace(pattern, '');
  });

  // If we removed everything, return the original text
  if (legalText.trim().length < 50) {
    return text;
  }

  return legalText;
};

/**
 * AI-Powered Document Comparison
 */
const compareDocumentsWithAI = async (
  userDocumentText: string,
  piaDocument: any,
  userFileName: string
): Promise<any> => {
  // Prepare PIA content from database chunks
  const piaContent = piaDocument.chunks
    .map((chunk: any) => `[${chunk.chapter}, Page ${chunk.pageNumber}]: ${chunk.content}`)
    .join('\n\n')
    .substring(0, 15000);

  const userContent = userDocumentText.substring(0, 10000);

  const analysisPrompt = `
    LEGAL DOCUMENT COMPLIANCE ANALYSIS

    TASK: Analyze how well the user's document complies with the Petroleum Industry Act (PIA) 2021.

    PIA DOCUMENT (Reference Standard):
    ${piaContent}

    USER DOCUMENT (To Analyze):
    ${userContent}

    IMPORTANT: Consider the document type and purpose. It could be:
    1. A comprehensive operational policy
    2. A test document for system validation
    3. A corporate policy document
    4. A draft compliance framework

    ANALYSIS REQUIREMENTS:

    1. IDENTIFY DOCUMENT TYPE:
    - Is this a comprehensive policy or a test document?
    - What level of detail is expected based on document type?

    2. COMPLIANCE ASSESSMENT:
    - For comprehensive documents: Check for specific PIA requirements
    - For test documents: Check for awareness of key PIA areas
    - Focus on substantive content, not formatting

    3. KEY PIA AREAS TO CHECK:
    - Governance & Institutions (Sections 1-64)
    - Licensing & Administration (Sections 65-89)
    - Host Communities (Sections 234-257, 3% OPEX requirement)
    - Environmental Protection (Sections 104-105)
    - Fiscal Framework (Sections 267-302, royalties 15%/12.5%/7.5%)
    - Health & Safety (Section 106)
    - Data & Reporting requirements
    - Nigerian Content requirements

    4. OUTPUT FORMAT (Valid JSON only):
    {
      "overview": {
        "complianceScore": 0-100,
        "summary": "Overall compliance assessment considering document type",
        "totalProvisionsAnalyzed": number,
        "majorComplianceAreas": ["area1", "area2"]
      },
      "detailedFindings": [
        {
          "category": "governance|licensing|host_communities|environment|fiscal|safety|reporting|nigerian_content",
          "provision": "Specific requirement from user document",
          "complianceStatus": "compliant|partial|non_compliant|missing",
          "piaReference": "Relevant PIA section",
          "analysis": "Detailed explanation",
          "severity": "high|medium|low",
          "recommendation": "Specific action to improve compliance"
        }
      ],
      "riskAssessment": {
        "highRiskIssues": number,
        "mediumRiskIssues": number,
        "lowRiskIssues": number,
        "overallRisk": "high|medium|low"
      },
      "recommendations": {
        "immediateActions": ["action1", "action2"],
        "priorityAreas": ["area1", "area2"],
        "complianceTimeline": "immediate_action_required|short_term|long_term",
        "allRecommendations": ["rec1", "rec2"]
      }
    }

    IMPORTANT: 
    - Adjust expectations based on document type and purpose
    - For test documents, focus on awareness rather than full compliance
    - Be specific about PIA section references
    - Provide actionable recommendations
    - Return valid JSON only
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a senior legal compliance analyst specializing in Nigerian petroleum industry regulations. 
          You understand different document types and adjust your analysis accordingly.
          For test documents, you check for awareness of key PIA areas.
          For comprehensive policies, you check for specific PIA compliance.
          Always return valid JSON format.`
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const aiResponse = response.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('AI analysis failed - no response received');
    }

    try {
      const parsedResult = JSON.parse(aiResponse);
      
      // Validate the response structure
      if (!parsedResult.overview || !parsedResult.detailedFindings) {
        throw new Error('Invalid AI response structure');
      }
      
      return parsedResult;
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.log('Raw AI response:', aiResponse.substring(0, 500));
      throw new Error('AI response format error - invalid JSON');
    }
  } catch (error) {
    console.error('❌ OpenAI API error:', error);
    throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * INTELLIGENT Local Compliance Analysis
 */
const performLocalComplianceAnalysis = (
  userDocumentText: string, 
  piaDocument: any,
  fileName: string
): any => {
  console.log('🔍 Performing INTELLIGENT local compliance analysis');
  
  const userText = userDocumentText.toLowerCase();
  
  // Get all PIA chunks from database
  const piaChunks = piaDocument.chunks || [];
  console.log(`📊 Using ${piaChunks.length} PIA chunks`);

  // Check if user document is essentially empty
  if (userText.trim().length < 30) {
    return generateEmptyDocumentAnalysis();
  }

  // 1. Analyze document context and type
  const documentContext = analyzeDocumentContextComprehensive(userDocumentText, fileName);
  console.log(`📄 Document analysis: ${documentContext.type}, ${documentContext.subtype}, ${documentContext.purpose}`);
  
  // 2. Extract PIA structure
  const piaStructure = extractPIAStructure(piaChunks);
  
  // 3. Extract user document structure
  const userStructure = extractDocumentStructure(userDocumentText, documentContext);
  
  // 4. Select analysis method based on document type
  if (documentContext.type === 'test_document' || documentContext.wordCount < 500) {
    console.log('🎯 Using lightweight analysis for simple/test document');
    return performLightweightAnalysis(userDocumentText, piaChunks, documentContext);
  } else if (documentContext.type === 'comprehensive_policy' || documentContext.hasDetailedStructure) {
    console.log('🎯 Using comprehensive analysis for detailed policy');
    return performComprehensiveAnalysis(userStructure, piaStructure, documentContext);
  } else {
    console.log('🎯 Using standard analysis');
    return performStandardAnalysis(userDocumentText, piaChunks, documentContext);
  }
};

/**
 * Comprehensive document context analysis
 */
const analyzeDocumentContextComprehensive = (text: string, filename: string): any => {
  const lowerText = text.toLowerCase();
  const lowerFilename = filename.toLowerCase();
  const wordCount = text.split(/\s+/).length;
  
  // Initialize context
  const context: any = {
    type: 'unknown',
    subtype: 'generic',
    purpose: 'compliance_check',
    wordCount: wordCount,
    hasLegalLanguage: false,
    hasDetailedStructure: false,
    mentionsPIA: false,
    isTestDocument: false,
    sections: []
  };
  
  // Check for test indicators
  const testIndicators = [
    'test document', 'testing', 'test version', 'internal system testing',
    'for testing purposes', 'demonstrating functionality', 'system validation'
  ];
  
  context.isTestDocument = testIndicators.some(indicator => 
    lowerText.includes(indicator) || lowerFilename.includes('test')
  );
  
  // Check for PIA mentions
  context.mentionsPIA = lowerText.includes('pia') || 
                       lowerText.includes('petroleum industry act') ||
                       lowerText.includes('2021');
  
  // Check for legal language
  context.hasLegalLanguage = /shall|must|required|obligation|compliance with|in accordance with/i.test(text);
  
  // Check structure
  const hasNumberedSections = (text.match(/\d+\.\s/g) || []).length > 3;
  const hasHeadings = (text.match(/[A-Z][A-Z\s]+:/g) || []).length > 3;
  context.hasDetailedStructure = hasNumberedSections || hasHeadings;
  
  // Extract sections
  const sectionMatches = text.match(/\d+\.\s+[^\n]+/g) || [];
  context.sections = sectionMatches.map((section: string) => 
    section.substring(0, 100).replace(/\n/g, ' ')
  );
  
  // Determine document type
  if (context.isTestDocument) {
    context.type = 'test_document';
    if (wordCount < 300) {
      context.subtype = 'minimal_test';
    } else if (wordCount < 800) {
      context.subtype = 'structured_test';
    } else {
      context.subtype = 'detailed_test';
    }
    context.purpose = 'system_validation';
  } else if (context.hasLegalLanguage && context.hasDetailedStructure) {
    context.type = 'comprehensive_policy';
    context.subtype = context.mentionsPIA ? 'pia_aware_policy' : 'general_policy';
    context.purpose = 'operational_compliance';
  } else if (context.hasDetailedStructure) {
    context.type = 'structured_document';
    context.subtype = 'operational_framework';
    context.purpose = 'internal_guidance';
  } else {
    context.type = 'simple_document';
    context.subtype = 'brief_statement';
    context.purpose = 'general_awareness';
  }
  
  // Check for specific content areas
  context.coversHostCommunities = lowerText.includes('community') || lowerText.includes('host');
  context.coversEnvironment = lowerText.includes('environment') || lowerText.includes('pollution');
  context.coversLicensing = lowerText.includes('license') || lowerText.includes('permit');
  context.coversReporting = lowerText.includes('report') || lowerText.includes('submit');
  context.coversSafety = lowerText.includes('safety') || lowerText.includes('health');
  
  return context;
};

/**
 * Extract PIA structure from chunks
 */
// const extractPIAStructure = (piaChunks: any[]): any => {
//   const structure = {
//     keyProvisions: [] as Array<{
//       section: string;
//       title: string;
//       content: string;
//       category: string;
//       keywords: string[];
//       requirement: string;
//       importance: 'high' | 'medium' | 'low';
//     }>
//   };

//   piaChunks.forEach(chunk => {
//     const content = chunk.content || '';
    
//     // Extract section numbers and titles
//     const sectionMatches = content.match(/(\d{1,3})\.\s+([^\n]+)/g);
//     if (sectionMatches) {
//       sectionMatches.forEach((match: any) => {
//         const sectionMatch = match.match(/(\d{1,3})\.\s+(.+)/);
//         if (sectionMatch) {
//           const sectionNum = sectionMatch[1];
//           const sectionTitle = sectionMatch[2].trim();
//           const sectionInt = parseInt(sectionNum);
          
//           // Categorize and determine importance
//           const category = categorizePIASection(sectionInt, sectionTitle, content);
//           const importance = determinePIAImportance(sectionInt, category, sectionTitle);
          
//           // Only include important or relevant sections
//           if (importance !== 'low' || isKeySection(sectionInt, category)) {
//             structure.keyProvisions.push({
//               section: sectionNum,
//               title: sectionTitle,
//               content: content.substring(0, 300),
//               category: category,
//               keywords: extractRelevantKeywords(content, category),
//               requirement: extractKeyRequirement(content),
//               importance: importance
//             });
//           }
//         }
//       });
//     }
//   });

//   console.log(`📚 Extracted ${structure.keyProvisions.length} key PIA provisions`);
//   return structure;
// };

/**
 * Enhanced PIA structure extraction with better categorization
 */
const extractPIAStructure = (piaChunks: any[]): any => {
  const structure = {
    keyProvisions: [] as Array<{
      section: string;
      title: string;
      content: string;
      category: string;
      keywords: string[];
      requirement: string;
      importance: 'high' | 'medium' | 'low';
      specificRequirements: string[]; // Add specific requirements
    }>
  };

  const seenProvisions = new Set<string>(); // Track seen provisions

  piaChunks.forEach(chunk => {
    const content = chunk.content || '';
    
    // Extract section numbers and titles with better pattern
    const sectionMatches = content.match(/(\d{1,3})\.\s+([^\n]+)/g);
    if (sectionMatches) {
      sectionMatches.forEach((match: any) => {
        const sectionMatch = match.match(/(\d{1,3})\.\s+(.+)/);
        if (sectionMatch) {
          const sectionNum = sectionMatch[1];
          const sectionTitle = sectionMatch[2].trim();
          const sectionInt = parseInt(sectionNum);
          
          // Create a unique key for this provision
          const provisionKey = `${sectionNum}-${sectionTitle.substring(0, 50)}`;
          
          // Skip if we've already seen this provision
          if (seenProvisions.has(provisionKey)) {
            return;
          }
          seenProvisions.add(provisionKey);
          
          // Categorize and determine importance
          const category = categorizePIASection(sectionInt, sectionTitle, content);
          const importance = determinePIAImportance(sectionInt, category, sectionTitle);
          
          // Extract specific requirements from the content
          const specificRequirements = extractSpecificRequirements(content, category);
          
          // Only include important or relevant sections
          if (importance !== 'low' || isKeySection(sectionInt, category)) {
            structure.keyProvisions.push({
              section: sectionNum,
              title: sectionTitle,
              content: content.substring(0, 300),
              category: category,
              keywords: extractRelevantKeywords(content, category),
              requirement: extractKeyRequirement(content),
              importance: importance,
              specificRequirements: specificRequirements
            });
          }
        }
      });
    }
  });

  console.log(`📚 Extracted ${structure.keyProvisions.length} unique key PIA provisions`);
  return structure;
};

/**
 * Extract specific requirements from content
 */
const extractSpecificRequirements = (content: string, category: string): string[] => {
  const requirements: string[] = [];
  const sentences = content.split(/[.!?]+/);
  
  sentences.forEach(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length < 10 || trimmed.length > 200) return;
    
    // Look for specific requirements based on category
    switch (category) {
      case 'host_communities':
        if (trimmed.toLowerCase().includes('%') || trimmed.toLowerCase().includes('opex')) {
          requirements.push(trimmed);
        }
        break;
      case 'environmental_protection':
        if (trimmed.toLowerCase().includes('spill') || trimmed.toLowerCase().includes('monitor')) {
          requirements.push(trimmed);
        }
        break;
      case 'safety_health':
        if (trimmed.toLowerCase().includes('emergency') || trimmed.toLowerCase().includes('risk')) {
          requirements.push(trimmed);
        }
        break;
      case 'fiscal':
      case 'royalty_payments':
        if (trimmed.toLowerCase().includes('%') || trimmed.toLowerCase().includes('royalty')) {
          requirements.push(trimmed);
        }
        break;
      default:
        if (trimmed.toLowerCase().includes('shall') || trimmed.toLowerCase().includes('must')) {
          requirements.push(trimmed);
        }
    }
  });
  
  return requirements.slice(0, 3); // Return top 3 requirements
};

/**
 * Extract document structure
 */
const extractDocumentStructure = (text: string, context: any): any => {
  const structure = {
    sections: [] as Array<{
      number: string;
      title: string;
      content: string;
      keywords: string[];
      hasRequirements: boolean;
    }>,
    coverage: {
      areas: [] as string[],
      depth: 'low' as 'high' | 'medium' | 'low'
    }
  };
  
  // Extract sections
  const sectionRegex = /(\d+|[A-Z])\.\s+([^\n]+)([\s\S]*?)(?=\n\s*(?:\d+|[A-Z])\.\s|\n\s*[A-Z][A-Z\s]+:|\n\s*$)/g;
  let match;
  
  while ((match = sectionRegex.exec(text + '\n')) !== null) {
    const number = match[1];
    const title = match[2];
    const content = match[3] || '';
    
    structure.sections.push({
      number,
      title: title.trim(),
      content: content.trim().substring(0, 500),
      keywords: extractKeywords(title + ' ' + content),
      hasRequirements: /shall|must|required|will\s+implement|commits\s+to/i.test(content)
    });
  }
  
  // If no numbered sections, try heading-based extraction
  if (structure.sections.length === 0) {
    const lines = text.split('\n');
    let currentSection:any = null;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && /^[A-Z][A-Z\s]+:$/.test(trimmed) || /^[A-Z].*:$/.test(trimmed)) {
        if (currentSection) {
          structure.sections.push(currentSection);
        }
        currentSection = {
          number: '',
          title: trimmed.replace(':', ''),
          content: '',
          keywords: extractKeywords(trimmed),
          hasRequirements: false
        };
      } else if (currentSection && trimmed) {
        currentSection.content += ' ' + trimmed;
        if (/shall|must|required/i.test(trimmed)) {
          currentSection.hasRequirements = true;
        }
      }
    });
    
    if (currentSection) {
      structure.sections.push(currentSection);
    }
  }
  
  // Determine coverage depth
  const totalSections = structure.sections.length;
  const sectionsWithRequirements = structure.sections.filter(s => s.hasRequirements).length;
  
  if (totalSections >= 8 && sectionsWithRequirements >= 5) {
    structure.coverage.depth = 'high';
  } else if (totalSections >= 4 && sectionsWithRequirements >= 2) {
    structure.coverage.depth = 'medium';
  } else {
    structure.coverage.depth = 'low';
  }
  
  // Determine covered areas
  const allText = text.toLowerCase();
  const coverageAreas = [];
  
  if (allText.includes('community') || allText.includes('host')) coverageAreas.push('host_communities');
  if (allText.includes('environment') || allText.includes('pollution')) coverageAreas.push('environmental');
  if (allText.includes('license') || allText.includes('permit')) coverageAreas.push('licensing');
  if (allText.includes('report') || allText.includes('data')) coverageAreas.push('reporting');
  if (allText.includes('safety') || allText.includes('health')) coverageAreas.push('safety');
  if (allText.includes('royalty') || allText.includes('payment')) coverageAreas.push('fiscal');
  if (allText.includes('governance') || allText.includes('board')) coverageAreas.push('governance');
  if (allText.includes('nigerian') || allText.includes('content')) coverageAreas.push('nigerian_content');
  
  structure.coverage.areas = [...new Set(coverageAreas)];
  
  console.log(`📑 Document has ${structure.sections.length} sections, depth: ${structure.coverage.depth}`);
  return structure;
};

/**
 * Lightweight analysis for test/simple documents
 */
const performLightweightAnalysis = (
  text: string,
  piaChunks: any[],
  context: any
): any => {
  console.log('⚡ Performing ENHANCED lightweight analysis');
  
  const findings: ComplianceFinding[] = [];
  const originalText = text; // Keep original for content extraction
  const lowerText = text.toLowerCase();
  const wordCount = context.wordCount;
  
  // Enhanced PIA areas with specific requirements
  const piaAreas = [
    {
      id: 'host_communities',
      category: 'host_communities',
      keywords: ['community', 'host', 'trust', 'development', 'contribution'],
      requiredKeywords: ['trust', 'development', 'community'],
      specificRequirements: ['3%', 'opex', 'percentage', 'fund'],
      description: 'Host Community Development',
      piaReference: 'PIA Sections 234-257',
      critical: true
    },
    {
      id: 'environmental_protection',
      category: 'environmental_protection',
      keywords: ['environment', 'pollution', 'spill', 'protection', 'mitigation'],
      requiredKeywords: ['environment', 'protection'],
      specificRequirements: ['monitoring', 'impact assessment', 'remediation'],
      description: 'Environmental Management',
      piaReference: 'PIA Sections 104-105',
      critical: true
    },
    {
      id: 'licensing_administration',
      category: 'licensing_administration',
      keywords: ['license', 'permit', 'regulatory', 'approval', 'authorization'],
      requiredKeywords: ['license', 'regulatory'],
      specificRequirements: ['compliance', 'renewal', 'authority'],
      description: 'Licensing & Regulatory Compliance',
      piaReference: 'PIA Sections 65-89',
      critical: false
    },
    {
      id: 'safety_health',
      category: 'safety_health',
      keywords: ['safety', 'health', 'emergency', 'risk', 'procedure'],
      requiredKeywords: ['safety', 'health'],
      specificRequirements: ['emergency response', 'risk assessment', 'procedures'],
      description: 'Health & Safety',
      piaReference: 'PIA Section 106',
      critical: true
    },
    {
      id: 'reporting',
      category: 'reporting',
      keywords: ['report', 'data', 'submit', 'information', 'document'],
      requiredKeywords: ['report', 'data'],
      specificRequirements: ['periodic', 'timely', 'accurate'],
      description: 'Reporting Requirements',
      piaReference: 'PIA relevant sections',
      critical: false
    },
    {
      id: 'governance',
      category: 'governance',
      keywords: ['governance', 'board', 'management', 'oversight', 'accountability'],
      requiredKeywords: ['governance', 'management'],
      specificRequirements: ['transparency', 'accountability', 'ethics'],
      description: 'Corporate Governance',
      piaReference: 'PIA governance provisions',
      critical: false
    },
    {
      id: 'fiscal',
      category: 'fiscal',
      keywords: ['royalty', 'payment', 'tax', 'fiscal', 'revenue'],
      requiredKeywords: ['royalty', 'payment'],
      specificRequirements: ['percentage', 'calculation', 'distribution'],
      description: 'Fiscal Framework',
      piaReference: 'PIA Sections 267-302',
      critical: false
    },
    {
      id: 'nigerian_content',
      category: 'nigerian_content',
      keywords: ['nigerian', 'content', 'local', 'capacity', 'development'],
      requiredKeywords: ['nigerian', 'content'],
      specificRequirements: ['local content', 'capacity building', 'technology transfer'],
      description: 'Nigerian Content',
      piaReference: 'PIA relevant sections',
      critical: false
    }
  ];

  // Check each PIA area with more sophisticated analysis
  piaAreas.forEach(area => {
    // Count keyword occurrences
    const keywordCount = area.keywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    ).length;
    
    // Check for required keywords
    const hasRequiredKeywords = area.requiredKeywords.every(keyword =>
      lowerText.includes(keyword.toLowerCase())
    );
    
    // Check for specific requirements
    const hasSpecificRequirements = area.specificRequirements.some(req =>
      lowerText.includes(req.toLowerCase())
    );
    
    // Extract relevant sentences for this area
    const relevantSentences = extractRelevantSentences(originalText, area.keywords);
    
    // Determine compliance status
    let complianceStatus: 'compliant' | 'partial' | 'non_compliant' | 'missing';
    let analysis = '';
    let severity: 'high' | 'medium' | 'low' = 'low';
    
    if (keywordCount === 0) {
      complianceStatus = 'missing';
      analysis = `${area.description} not mentioned`;
      severity = area.critical ? 'medium' : 'low';
    } else if (hasRequiredKeywords && hasSpecificRequirements && keywordCount >= 3) {
      complianceStatus = 'compliant';
      analysis = `Strong coverage of ${area.description.toLowerCase()}`;
      severity = 'low';
    } else if (hasRequiredKeywords && keywordCount >= 2) {
      complianceStatus = 'partial';
      analysis = `Basic coverage of ${area.description.toLowerCase()}`;
      severity = area.critical ? 'medium' : 'low';
    } else {
      complianceStatus = 'non_compliant';
      analysis = `Limited or inadequate coverage of ${area.description.toLowerCase()}`;
      severity = area.critical ? 'medium' : 'low';
    }
    
    // Add finding only if not compliant or has issues
    if (complianceStatus !== 'compliant' || area.critical) {
      // Extract specific content from the document for better analysis
      const documentSpecificContent = extractAreaContent(originalText, area.keywords);
      
      findings.push({
        category: area.category,
        provision: area.description,
        complianceStatus: complianceStatus,
        piaReference: area.piaReference,
        analysis: `${analysis}. ${relevantSentences.length > 0 ? 'Found references: ' + relevantSentences.join('; ') : ''}`,
        severity: severity,
        recommendation: generateAreaSpecificRecommendation(area, complianceStatus, documentSpecificContent)
      });
    }
  });

  // Calculate score based on multiple factors
  let complianceScore = calculateEnhancedScore(findings, context, piaAreas);
  
  // Generate document-specific summary
  const summary = generateDocumentSpecificSummary(complianceScore, findings, context, originalText);

  return {
    overview: {
      complianceScore: complianceScore,
      summary: summary,
      totalProvisionsAnalyzed: findings.length,
      majorComplianceAreas: getTopComplianceAreas(findings, 3)
    },
    detailedFindings: findings.slice(0, 10),
    riskAssessment: calculateEnhancedRiskAssessment(findings, context),
    recommendations: generateEnhancedRecommendations(findings, context, originalText)
  };
};
/**
 * Comprehensive analysis for detailed policies
 */
// const performComprehensiveAnalysis = (
//   userStructure: any,
//   piaStructure: any,
//   context: any
// ): any => {
//   console.log('📋 Performing comprehensive analysis');
  
//   const findings: ComplianceFinding[] = [];
  
//   // Match user sections with PIA provisions
//   userStructure.sections.forEach((userSection: any) => {
//     const sectionText = (userSection.title + ' ' + userSection.content).toLowerCase();
    
//     // Find relevant PIA provisions for this section
//     const relevantPIAProvisions = piaStructure.keyProvisions.filter((piaProv: any) => 
//       areProvisionsRelevant(piaProv, sectionText, userSection.title)
//     );
    
//     // Check each relevant PIA provision
//     relevantPIAProvisions.forEach((piaProv: any) => {
//       const matchScore = calculateComprehensiveMatchScore(piaProv, userSection);
//       const complianceStatus = determineComprehensiveCompliance(piaProv, userSection, matchScore);
//       const severity = determineComprehensiveSeverity(piaProv.category, complianceStatus, context);
      
//       if (complianceStatus !== 'compliant' || severity !== 'low') {
//         findings.push({
//           category: piaProv.category,
//           provision: piaProv.title,
//           complianceStatus: complianceStatus,
//           piaReference: `PIA Section ${piaProv.section}`,
//           analysis: generateComprehensiveAnalysisText(piaProv, userSection, complianceStatus),
//           severity: severity,
//           recommendation: generateComprehensiveRecommendation(piaProv, complianceStatus, userSection)
//         });
//       }
//     });
//   });
  
//   // Check for missing critical PIA provisions
//   const criticalPIAProvisions = piaStructure.keyProvisions.filter((p: any) => 
//     p.importance === 'high' && 
//     !findings.some(f => f.provision.includes(p.title.substring(0, 50)))
//   );
  
//   criticalPIAProvisions.slice(0, 5).forEach((piaProv: any) => {
//     findings.push({
//       category: piaProv.category,
//       provision: piaProv.title,
//       complianceStatus: 'missing',
//       piaReference: `PIA Section ${piaProv.section}`,
//       analysis: `Critical PIA requirement not specifically addressed: ${piaProv.requirement.substring(0, 100)}...`,
//       severity: 'medium',
//       recommendation: `Add specific provision for: ${piaProv.title}`
//     });
//   });
  
//   // Calculate score
//   const complianceScore = calculateComprehensiveScore(findings, userStructure.sections.length, context);
  
//   return {
//     overview: {
//       complianceScore: complianceScore,
//       summary: generateComprehensiveSummary(complianceScore, findings.length, context),
//       totalProvisionsAnalyzed: findings.length,
//       majorComplianceAreas: [...new Set(findings.map(f => f.category))]
//     },
//     detailedFindings: findings.slice(0, 15),
//     riskAssessment: {
//       highRiskIssues: findings.filter(f => f.severity === 'high').length,
//       mediumRiskIssues: findings.filter(f => f.severity === 'medium').length,
//       lowRiskIssues: findings.filter(f => f.severity === 'low').length,
//       overallRisk: findings.filter(f => f.severity === 'high').length >= 2 ? 'high' :
//                   findings.filter(f => f.severity === 'high').length >= 1 ? 'medium' :
//                   findings.filter(f => f.severity === 'medium').length >= 3 ? 'medium' : 'low'
//     },
//     recommendations: generateComprehensiveRecommendations(findings, context)
//   };
// };

// /**
//  * Standard analysis for general documents
//  */
const performStandardAnalysis = (
  text: string,
  piaChunks: any[],
  context: any
): any => {
  console.log('📊 Performing standard analysis');
  
  const findings: ComplianceFinding[] = [];
  const lowerText = text.toLowerCase();
  
  // Define compliance checks with PIA references
  const complianceChecks = [
    {
      category: 'host_communities',
      description: 'Host Community Development Trust',
      check: () => {
        const mentionsCommunity = lowerText.includes('community') || lowerText.includes('host');
        const mentionsTrust = lowerText.includes('trust') || lowerText.includes('development fund');
        const mentionsPercentage = /\d+\s*%/.test(text) && lowerText.includes('opex');
        
        if (mentionsPercentage && mentionsTrust) {
          return { status: 'compliant', analysis: 'Specific percentage and trust mentioned' };
        } else if (mentionsCommunity && mentionsTrust) {
          return { status: 'partial', analysis: 'Community and trust mentioned but no specific percentage' };
        } else if (mentionsCommunity) {
          return { status: 'partial', analysis: 'Community mentioned but trust not specified' };
        }
        return { status: 'missing', analysis: 'Host community requirements not addressed' };
      },
      piaReference: 'PIA Sections 234-257',
      severity: (status: string) => status === 'missing' ? 'high' : 'low'
    },
    {
      category: 'environmental_protection',
      description: 'Environmental Management',
      check: () => {
        const hasEnvironment = lowerText.includes('environment') || lowerText.includes('pollution');
        const hasSpillResponse = lowerText.includes('spill') && lowerText.includes('response');
        const hasMonitoring = lowerText.includes('monitor') || lowerText.includes('audit');
        
        if (hasSpillResponse && hasMonitoring) {
          return { status: 'compliant', analysis: 'Comprehensive environmental provisions' };
        } else if (hasEnvironment && hasMonitoring) {
          return { status: 'partial', analysis: 'Environmental monitoring mentioned' };
        } else if (hasEnvironment) {
          return { status: 'partial', analysis: 'Environment mentioned but details limited' };
        }
        return { status: 'missing', analysis: 'Environmental protection not addressed' };
      },
      piaReference: 'PIA Sections 104-105',
      severity: (status: string) => status === 'missing' ? 'high' : 'low'
    },
    {
      category: 'licensing_administration',
      description: 'Licensing Compliance',
      check: () => {
        const hasLicense = lowerText.includes('license') || lowerText.includes('permit');
        const hasRegulatory = lowerText.includes('regulatory') || lowerText.includes('authority');
        const hasCompliance = lowerText.includes('compliance') || lowerText.includes('requirement');
        
        if (hasLicense && hasRegulatory && hasCompliance) {
          return { status: 'compliant', analysis: 'Comprehensive licensing compliance mentioned' };
        } else if (hasLicense && hasRegulatory) {
          return { status: 'partial', analysis: 'Licensing and regulatory authorities mentioned' };
        } else if (hasLicense) {
          return { status: 'partial', analysis: 'Licensing mentioned but regulatory aspects unclear' };
        }
        return { status: 'missing', analysis: 'Licensing requirements not addressed' };
      },
      piaReference: 'PIA Sections 65-89',
      severity: (status: string): 'high' | 'medium' | 'low' => 'medium'
    },
    {
      category: 'safety_health',
      description: 'Health and Safety',
      check: () => {
        const hasSafety = lowerText.includes('safety') || lowerText.includes('health');
        const hasEmergency = lowerText.includes('emergency') || lowerText.includes('response');
        const hasProcedures = lowerText.includes('procedure') || lowerText.includes('standard');
        
        if (hasSafety && hasEmergency && hasProcedures) {
          return { status: 'compliant', analysis: 'Comprehensive safety provisions' };
        } else if (hasSafety && hasEmergency) {
          return { status: 'partial', analysis: 'Safety and emergency response mentioned' };
        } else if (hasSafety) {
          return { status: 'partial', analysis: 'Safety mentioned but procedures unclear' };
        }
        return { status: 'missing', analysis: 'Health and safety not addressed' };
      },
      piaReference: 'PIA Section 106',
      severity: (status: string) => status === 'missing' ? 'high' : 'low'
    }
  ];
  
  // Run checks
  complianceChecks.forEach(check => {
    const result = check.check();
    if (result.status !== 'compliant' || context.type !== 'test_document') {
      findings.push({
        category: check.category,
        provision: check.description,
        complianceStatus: result.status as any,
        piaReference: check.piaReference,
        analysis: result.analysis,
        severity: check.severity(result.status) as 'high' | 'medium' | 'low',
        recommendation: generateStandardRecommendation(check.category, result.status)
      });
    }
  });
  
  // Calculate score
  const compliantCount = findings.filter(f => f.complianceStatus === 'compliant').length;
  const partialCount = findings.filter(f => f.complianceStatus === 'partial').length;
  const total = findings.length;
  const complianceScore = total > 0 ? 
    Math.round(((compliantCount + partialCount * 0.5) / total) * 100) : 
    (context.type === 'test_document' ? 50 : 30);
  
  return {
    overview: {
      complianceScore: complianceScore,
      summary: generateStandardSummary(complianceScore, context, findings.length),
      totalProvisionsAnalyzed: findings.length,
      majorComplianceAreas: [...new Set(findings.map(f => f.category))]
    },
    detailedFindings: findings.slice(0, 10),
    riskAssessment: {
      highRiskIssues: findings.filter(f => f.severity === 'high').length,
      mediumRiskIssues: findings.filter(f => f.severity === 'medium').length,
      lowRiskIssues: findings.filter(f => f.severity === 'low').length,
      overallRisk: findings.filter(f => f.severity === 'high').length > 0 ? 'high' :
                  findings.filter(f => f.severity === 'medium').length > 0 ? 'medium' : 'low'
    },
    recommendations: generateStandardRecommendations(findings, context)
  };
};


/**
 * Enhanced comprehensive analysis with intelligent filtering
 */
const performComprehensiveAnalysis = (
  userStructure: any,
  piaStructure: any,
  context: any
): any => {
  console.log('📋 Performing ENHANCED comprehensive analysis');
  
  const findings: ComplianceFinding[] = [];
  const seenFindings = new Set<string>(); // Track seen findings to avoid duplicates
  
  // Group user sections by category for better analysis
  const userSectionsByCategory: Record<string, any[]> = {};
  
  userStructure.sections.forEach((userSection: any) => {
    const sectionCategory = determineSectionCategory(userSection.title, userSection.content);
    if (!userSectionsByCategory[sectionCategory]) {
      userSectionsByCategory[sectionCategory] = [];
    }
    userSectionsByCategory[sectionCategory].push(userSection);
  });
  
  // Analyze each PIA provision intelligently
  piaStructure.keyProvisions.forEach((piaProv: any) => {
    // Find user sections that might be relevant to this PIA provision
    const relevantUserSections = findRelevantUserSections(piaProv, userStructure.sections);
    
    if (relevantUserSections.length === 0) {
      // No relevant sections found - this is a missing requirement
      const findingKey = `missing-${piaProv.category}-${piaProv.section}`;
      if (!seenFindings.has(findingKey) && piaProv.importance !== 'low') {
        findings.push({
          category: piaProv.category,
          provision: piaProv.title,
          complianceStatus: 'missing',
          piaReference: `PIA Section ${piaProv.section}`,
          analysis: `PIA requirement not addressed in the document: ${piaProv.requirement}`,
          severity: piaProv.importance,
          recommendation: generateMissingRecommendation(piaProv)
        });
        seenFindings.add(findingKey);
      }
      return;
    }
    
    // Analyze each relevant user section
    relevantUserSections.slice(0, 2).forEach((userSection: any) => { // Limit to 2 sections per provision
      const matchScore = calculateComprehensiveMatchScore(piaProv, userSection);
      const complianceStatus = determineComprehensiveCompliance(piaProv, userSection, matchScore);
      
      // Only create finding if there's an issue or it's important
      if (complianceStatus !== 'compliant' || piaProv.importance === 'high') {
        const findingKey = `${piaProv.section}-${userSection.title}-${complianceStatus}`;
        
        if (!seenFindings.has(findingKey)) {
          const severity = determineComprehensiveSeverity(piaProv.category, complianceStatus, context);
          
          findings.push({
            category: piaProv.category,
            provision: piaProv.title,
            complianceStatus: complianceStatus,
            piaReference: `PIA Section ${piaProv.section}`,
            analysis: generateDetailedAnalysis(piaProv, userSection, complianceStatus, matchScore),
            severity: severity,
            recommendation: generateSpecificRecommendation(piaProv, userSection, complianceStatus)
          });
          seenFindings.add(findingKey);
        }
      }
    });
  });
  
  // Add category-level findings for broader analysis
  addCategoryLevelFindings(findings, userSectionsByCategory, piaStructure, context);
  
  // Prioritize findings: high severity first, then by importance
  const prioritizedFindings = prioritizeFindings(findings);
  
  // Calculate score
  const complianceScore = calculateComprehensiveScore(prioritizedFindings, userStructure.sections.length, context);
  
  return {
    overview: {
      complianceScore: complianceScore,
      summary: generateComprehensiveSummary(complianceScore, prioritizedFindings.length, context),
      totalProvisionsAnalyzed: Math.min(prioritizedFindings.length, 50), // Reasonable limit
      majorComplianceAreas: getTopComplianceAreas(prioritizedFindings, 5)
    },
    detailedFindings: prioritizedFindings.slice(0, 30), // Return top 30 findings
    riskAssessment: calculateEnhancedRiskAssessment(prioritizedFindings, context),
    recommendations: generateIntelligentRecommendations(prioritizedFindings, context, userStructure)
  };
};

/**
 * Find relevant user sections for a PIA provision
 */
const findRelevantUserSections = (piaProv: any, userSections: any[]): any[] => {
  const relevantSections: any[] = [];
  
  userSections.forEach(section => {
    const sectionText = (section.title + ' ' + section.content).toLowerCase();
    
    // Check keyword overlap
    const keywordMatches = piaProv.keywords.filter((kw: string) => 
      sectionText.includes(kw.toLowerCase())
    ).length;
    
    // Check category match
    const sectionCategory = determineSectionCategory(section.title, section.content);
    const categoryMatch = sectionCategory === piaProv.category;
    
    // Check if section mentions PIA
    const mentionsPIA = sectionText.includes('pia') || 
      sectionText.includes('petroleum industry act');
    
    // Score relevance
    const relevanceScore = (keywordMatches * 2) + (categoryMatch ? 3 : 0) + (mentionsPIA ? 1 : 0);
    
    if (relevanceScore > 0) {
      relevantSections.push({
        ...section,
        relevanceScore
      });
    }
  });
  
  // Sort by relevance score
  return relevantSections.sort((a, b) => b.relevanceScore - a.relevanceScore);
};

/**
 * Generate missing requirement recommendation
 */
const generateMissingRecommendation = (piaProv: any): string => {
  const categoryName = piaProv.category.replace('_', ' ');
  
  if (piaProv.specificRequirements && piaProv.specificRequirements.length > 0) {
    const firstRequirement = piaProv.specificRequirements[0].substring(0, 100);
    return `Add ${categoryName} provision: ${firstRequirement}... (PIA Section ${piaProv.section})`;
  }
  
  return `Include ${categoryName} requirements from PIA Section ${piaProv.section}`;
};

/**
 * Generate detailed analysis
 */
const generateDetailedAnalysis = (piaProv: any, userSection: any, status: string, matchScore: number): string => {
  const sectionName = userSection.title || 'unnamed section';
  const categoryName = piaProv.category.replace('_', ' ');
  
  switch (status) {
    case 'compliant':
      return `Section "${sectionName}" adequately addresses ${categoryName} requirements (score: ${matchScore.toFixed(2)})`;
    case 'partial':
      return `Section "${sectionName}" partially addresses ${categoryName} but lacks specific details (score: ${matchScore.toFixed(2)})`;
    case 'non_compliant':
      return `Section "${sectionName}" inadequately addresses ${categoryName} requirements (score: ${matchScore.toFixed(2)})`;
    default:
      return `${categoryName} requirements from PIA Section ${piaProv.section} not adequately addressed in "${sectionName}"`;
  }
};

/**
 * Generate specific, non-repetitive recommendations
 */
const generateSpecificRecommendation = (piaProv: any, userSection: any, status: string): string => {
  const sectionName = userSection.title || 'the document';
  const categoryName = piaProv.category.replace('_', ' ');
  
  // Use specific requirements if available
  if (piaProv.specificRequirements && piaProv.specificRequirements.length > 0 && status !== 'compliant') {
    const req = piaProv.specificRequirements[0];
    if (req.length < 80) {
      return `In "${sectionName}", add: "${req}" (PIA Section ${piaProv.section})`;
    }
  }
  
  // Category-specific recommendations
  const recommendations: Record<string, Record<string, string>> = {
    'host_communities': {
      'partial': `Specify 3% OPEX contribution and trust framework in "${sectionName}"`,
      'non_compliant': `Implement host community development trust in "${sectionName}" per PIA Sections 234-257`,
      'missing': `Add host community provisions to "${sectionName}" including 3% OPEX requirement`
    },
    'environmental_protection': {
      'partial': `Add specific environmental monitoring and spill response procedures to "${sectionName}"`,
      'non_compliant': `Implement comprehensive environmental management system in "${sectionName}"`,
      'missing': `Include environmental protection measures in "${sectionName}" per PIA Sections 104-105`
    },
    'safety_health': {
      'partial': `Specify emergency response procedures in "${sectionName}"`,
      'non_compliant': `Implement health and safety management system in "${sectionName}"`,
      'missing': `Add safety and health provisions to "${sectionName}" per PIA Section 106`
    },
    'licensing_administration': {
      'partial': `Detail licensing compliance procedures in "${sectionName}"`,
      'non_compliant': `Establish licensing framework in "${sectionName}"`,
      'missing': `Include licensing requirements in "${sectionName}" per PIA Sections 65-89`
    }
  };
  
  // Get category-specific recommendation or fallback
  const categoryRecs = recommendations[piaProv.category];
  if (categoryRecs && categoryRecs[status]) {
    return categoryRecs[status];
  }
  
  // Generic fallback
  const actions:any = {
    'partial': 'Add specific requirements to',
    'non_compliant': 'Revise to comply with',
    'missing': 'Include provisions for'
  };
  
  return `${actions[status] || 'Address'} ${categoryName} in "${sectionName}" (PIA Section ${piaProv.section})`;
};

/**
 * Add category-level findings
 */
const addCategoryLevelFindings = (
  findings: ComplianceFinding[],
  userSectionsByCategory: Record<string, any[]>,
  piaStructure: any,
  context: any
): void => {
  const criticalCategories = ['host_communities', 'environmental_protection', 'safety_health'];
  
  criticalCategories.forEach(category => {
    const userSections = userSectionsByCategory[category] || [];
    const piaProvisions = piaStructure.keyProvisions.filter((p: any) => p.category === category);
    
    if (userSections.length === 0 && piaProvisions.length > 0) {
      // Category completely missing
      findings.push({
        category: category,
        provision: `${category.replace('_', ' ')} framework`,
        complianceStatus: 'missing',
        piaReference: 'Multiple PIA sections',
        analysis: `No specific section addresses ${category.replace('_', ' ')} requirements`,
        severity: 'high',
        recommendation: `Create dedicated section for ${category.replace('_', ' ')} compliance`
      });
    } else if (userSections.length > 0 && piaProvisions.length > 0) {
      // Check if coverage is comprehensive
      const coverageScore = calculateCategoryCoverage(userSections, piaProvisions);
      if (coverageScore < 0.3) {
        findings.push({
          category: category,
          provision: `Comprehensive ${category.replace('_', ' ')} coverage`,
          complianceStatus: 'partial',
          piaReference: 'Multiple PIA sections',
          analysis: `Limited coverage of ${category.replace('_', ' ')} requirements (score: ${coverageScore.toFixed(2)})`,
          severity: 'medium',
          recommendation: `Expand ${category.replace('_', ' ')} section to cover all PIA requirements`
        });
      }
    }
  });
};

/**
 * Calculate category coverage score
 */
const calculateCategoryCoverage = (userSections: any[], piaProvisions: any[]): number => {
  if (piaProvisions.length === 0) return 0;
  
  let totalScore = 0;
  piaProvisions.forEach(piaProv => {
    let bestMatch = 0;
    userSections.forEach(section => {
      const sectionText = (section.title + ' ' + section.content).toLowerCase();
      const keywordMatches = piaProv.keywords.filter((kw: string) => 
        sectionText.includes(kw.toLowerCase())
      ).length;
      const matchScore = keywordMatches / Math.max(piaProv.keywords.length, 1);
      bestMatch = Math.max(bestMatch, matchScore);
    });
    totalScore += bestMatch;
  });
  
  return totalScore / piaProvisions.length;
};

/**
 * Prioritize findings
 */
const prioritizeFindings = (findings: ComplianceFinding[]): ComplianceFinding[] => {
  return findings.sort((a, b) => {
    // First by severity
    const severityOrder = { high: 3, medium: 2, low: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    
    // Then by compliance status
    const statusOrder = { missing: 4, non_compliant: 3, partial: 2, compliant: 1 };
    if (statusOrder[a.complianceStatus] !== statusOrder[b.complianceStatus]) {
      return statusOrder[b.complianceStatus] - statusOrder[a.complianceStatus];
    }
    
    // Then by category (critical categories first)
    const criticalCategories = ['host_communities', 'environmental_protection', 'safety_health'];
    const aIsCritical = criticalCategories.includes(a.category);
    const bIsCritical = criticalCategories.includes(b.category);
    if (aIsCritical !== bIsCritical) {
      return aIsCritical ? -1 : 1;
    }
    
    return 0;
  });
};


/**
 * Generate intelligent recommendations without repetition
 */
const generateIntelligentRecommendations = (
  findings: ComplianceFinding[], 
  context: any,
  userStructure: any
): Recommendations => {
  const immediateActions = new Set<string>();
  const priorityAreas = new Set<string>();
  const allRecommendations = new Set<string>();
  
  // Group findings for better recommendation generation
  const findingsBySeverity: Record<string, ComplianceFinding[]> = {
    high: [],
    medium: [],
    low: []
  };
  
  const findingsByCategory: Record<string, ComplianceFinding[]> = {};
  
  findings.forEach(finding => {
    findingsBySeverity[finding.severity].push(finding);
    
    if (!findingsByCategory[finding.category]) {
      findingsByCategory[finding.category] = [];
    }
    findingsByCategory[finding.category].push(finding);
  });
  
  // Add high severity findings as immediate actions
  findingsBySeverity.high.slice(0, 3).forEach(finding => {
    immediateActions.add(finding.recommendation);
  });
  
  // Determine priority areas based on findings
  Object.entries(findingsByCategory).forEach(([category, categoryFindings]) => {
    const highSeverityCount = categoryFindings.filter(f => f.severity === 'high').length;
    const missingCount = categoryFindings.filter(f => f.complianceStatus === 'missing').length;
    
    if (highSeverityCount > 0 || missingCount > 0) {
      priorityAreas.add(category.replace('_', ' '));
    }
  });
  
  // Generate category-specific recommendations
  Object.entries(findingsByCategory).forEach(([category, categoryFindings]) => {
    const categoryName = category.replace('_', ' ');
    const statuses = new Set(categoryFindings.map(f => f.complianceStatus));
    
    if (statuses.has('missing')) {
      allRecommendations.add(`Create dedicated section for ${categoryName} compliance`);
    } else if (statuses.has('non_compliant')) {
      allRecommendations.add(`Review and strengthen ${categoryName} provisions`);
    } else if (statuses.has('partial') && categoryFindings.length > 2) {
      allRecommendations.add(`Add specific details to ${categoryName} requirements`);
    }
  });
  
  // Document structure recommendations
  if (userStructure.sections.length < 5) {
    allRecommendations.add('Expand document structure to cover all PIA compliance areas');
  }
  
  if (context.type === 'test_document') {
    immediateActions.add('Convert test statements to legally binding requirements');
    allRecommendations.add('Replace placeholder text with specific PIA requirements');
    allRecommendations.add('Reference actual PIA sections with specific requirements');
  } else {
    // Check for critical missing areas
    const criticalCategories = ['host_communities', 'environmental_protection', 'safety_health'];
    const missingCritical = criticalCategories.filter(cat => 
      findingsByCategory[cat]?.some(f => f.complianceStatus === 'missing')
    );
    
    if (missingCritical.length > 0) {
      const formatted = missingCritical.map(c => c.replace('_', ' ')).join(', ');
      immediateActions.add(`Address missing critical areas: ${formatted}`);
    }
  }
  
  // Add general best practice recommendations
  allRecommendations.add('Include specific percentages, timelines, and measurable indicators');
  allRecommendations.add('Reference PIA sections directly in each requirement');
  allRecommendations.add('Establish clear accountability for each compliance requirement');
  allRecommendations.add('Implement regular compliance review and update process');
  
  // Convert to arrays with reasonable limits
  return {
    immediateActions: Array.from(immediateActions).slice(0, 5),
    priorityAreas: Array.from(priorityAreas).slice(0, 5),
    complianceTimeline: immediateActions.size > 0 ? 'immediate_action_required' : 
                       allRecommendations.size > 0 ? 'short_term' : 'long_term',
    allRecommendations: Array.from(allRecommendations).slice(0, 10)
  };
};

/**
 * Helper functions
 */

 /**
 * Extract relevant sentences containing keywords
 */
const extractRelevantSentences = (text: string, keywords: string[]): string[] => {
  const sentences = text.split(/[.!?]+/);
  const relevantSentences: string[] = [];
  
  sentences.forEach(sentence => {
    const lowerSentence = sentence.toLowerCase();
    const matchingKeywords = keywords.filter(keyword => 
      lowerSentence.includes(keyword.toLowerCase())
    );
    
    if (matchingKeywords.length > 0 && sentence.trim().length > 10) {
      relevantSentences.push(sentence.trim().substring(0, 150));
    }
  });
  
  return relevantSentences.slice(0, 3); // Return top 3 relevant sentences
};

/**
 * Extract specific content for an area
 */
const extractAreaContent = (text: string, keywords: string[]): string => {
  const paragraphs = text.split('\n');
  let relevantContent = '';
  
  paragraphs.forEach(paragraph => {
    const lowerParagraph = paragraph.toLowerCase();
    const hasKeywords = keywords.some(keyword => 
      lowerParagraph.includes(keyword.toLowerCase())
    );
    
    if (hasKeywords && paragraph.trim().length > 20) {
      relevantContent += paragraph.trim().substring(0, 200) + ' ';
    }
  });
  
  return relevantContent.trim();
};

/**
 * Generate area-specific recommendations
 */
const generateAreaSpecificRecommendation = (
  area: any, 
  status: string, 
  documentContent: string
): string => {
  const areaName = area.description.toLowerCase();
  
  switch (status) {
    case 'compliant':
      return `Maintain strong coverage of ${areaName} with specific PIA references`;
    case 'partial':
      if (documentContent.includes('internal') || documentContent.includes('company')) {
        return `Convert internal procedures to PIA-specific requirements for ${areaName}`;
      }
      return `Add specific PIA requirements and details for ${areaName}`;
    case 'non_compliant':
      return `Implement comprehensive ${areaName} framework per PIA ${area.piaReference}`;
    case 'missing':
      if (area.critical) {
        return `CRITICAL: Add ${areaName} provisions per PIA ${area.piaReference}`;
      }
      return `Include ${areaName} requirements in your compliance framework`;
    default:
      return `Address ${areaName} requirements`;
  }
};

/**
 * Calculate enhanced score
 */
const calculateEnhancedScore = (
  findings: ComplianceFinding[], 
  context: any, 
  allAreas: any[]
): number => {
  let score = 0;
  let maxScore = 0;
  
  findings.forEach(finding => {
    const area = allAreas.find(a => a.category === finding.category);
    const weight = area?.critical ? 2 : 1;
    
    maxScore += weight;
    
    switch (finding.complianceStatus) {
      case 'compliant':
        score += weight * 1.0;
        break;
      case 'partial':
        score += weight * 0.5;
        break;
      case 'non_compliant':
        score += weight * 0.2;
        break;
      case 'missing':
        score += weight * 0;
        break;
    }
  });
  
  // Handle documents with very few findings
  if (findings.length < 3) {
    return context.type === 'test_document' ? 50 : 30;
  }
  
  const baseScore = maxScore > 0 ? (score / maxScore) * 100 : 0;
  
  // Adjust for document type
  let adjustedScore = baseScore;
  if (context.type === 'test_document') {
    adjustedScore = Math.min(baseScore + 20, 85); // Test docs get boost but capped
  } else if (context.wordCount < 300) {
    adjustedScore = Math.min(baseScore, 60); // Short docs capped lower
  }
  
  return Math.round(adjustedScore);
};

/**
 * Generate document-specific summary
 */
const generateDocumentSpecificSummary = (
  score: number, 
  findings: ComplianceFinding[], 
  context: any,
  documentText: string
): string => {
  const compliantCount = findings.filter(f => f.complianceStatus === 'compliant').length;
  const missingCount = findings.filter(f => f.complianceStatus === 'missing').length;
  
  // Check document characteristics
  const hasPIAReference = documentText.toLowerCase().includes('pia') || 
                         documentText.toLowerCase().includes('petroleum industry act');
  const hasSpecificRequirements = findings.some(f => 
    f.analysis.includes('specific') || f.analysis.includes('detailed')
  );
  const wordCount = documentText.split(/\s+/).length;
  
  if (context.type === 'test_document') {
    if (hasPIAReference && hasSpecificRequirements) {
      return 'Test document shows good PIA awareness with specific references';
    } else if (hasPIAReference) {
      return 'Test document acknowledges PIA but lacks specific requirements';
    } else {
      return 'Test document covers compliance areas but missing PIA-specific references';
    }
  }
  
  if (score >= 85) {
    return 'Excellent PIA compliance with comprehensive coverage';
  } else if (score >= 70) {
    return 'Good PIA compliance with minor gaps in specific areas';
  } else if (score >= 55) {
    return 'Moderate PIA compliance requiring attention to several areas';
  } else if (score >= 40) {
    return 'Partial PIA compliance - significant improvements needed';
  } else {
    return 'Inadequate PIA compliance - major revision required';
  }
};

/**
 * Get top compliance areas
 */
const getTopComplianceAreas = (findings: ComplianceFinding[], limit: number): string[] => {
  const areaScores: Record<string, number> = {};
  
  findings.forEach(finding => {
    const score = finding.complianceStatus === 'compliant' ? 3 :
                  finding.complianceStatus === 'partial' ? 2 :
                  finding.complianceStatus === 'non_compliant' ? 1 : 0;
    
    areaScores[finding.category] = (areaScores[finding.category] || 0) + score;
  });
  
  return Object.entries(areaScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([area]) => area);
};

/**
 * Calculate enhanced risk assessment
 */
const calculateEnhancedRiskAssessment = (
  findings: ComplianceFinding[], 
  context: any
): RiskAssessment => {
  const highRisk = findings.filter(f => f.severity === 'high').length;
  const mediumRisk = findings.filter(f => f.severity === 'medium').length;
  const lowRisk = findings.filter(f => f.severity === 'low').length;
  
  let overallRisk: 'high' | 'medium' | 'low';
  
  // Calculate overall risk considering document type
  if (highRisk >= 2 || (highRisk >= 1 && mediumRisk >= 2)) {
    overallRisk = 'high';
  } else if (highRisk >= 1 || mediumRisk >= 3) {
    overallRisk = 'medium';
  } else {
    overallRisk = 'low';
  }
  
  // Adjust for test documents
  if (context.type === 'test_document') {
    overallRisk = overallRisk === 'high' ? 'medium' : overallRisk;
  }
  
  return {
    highRiskIssues: highRisk,
    mediumRiskIssues: mediumRisk,
    lowRiskIssues: lowRisk,
    overallRisk
  };
};

/**
 * Generate enhanced recommendations
 */
/**
 * Generate enhanced recommendations without repetition
 */
const generateEnhancedRecommendations = (
  findings: ComplianceFinding[], 
  context: any,
  documentText: string
): Recommendations => {
  const immediateActionsSet = new Set<string>();
  const priorityAreasSet = new Set<string>();
  const allRecommendationsSet = new Set<string>();
  
  // Group findings by section for better recommendations
  const findingsBySection: Record<string, ComplianceFinding[]> = {};
  const findingsByCategory: Record<string, ComplianceFinding[]> = {};
  
  // Organize findings
  findings.forEach(finding => {
    // Extract section from analysis or use category
    const sectionMatch = finding.analysis.match(/section "([^"]+)"/i);
    const section = sectionMatch ? sectionMatch[1] : finding.category.replace('_', ' ');
    
    if (!findingsBySection[section]) {
      findingsBySection[section] = [];
    }
    findingsBySection[section].push(finding);
    
    if (!findingsByCategory[finding.category]) {
      findingsByCategory[finding.category] = [];
    }
    findingsByCategory[finding.category].push(finding);
  });
  
  // Check if document is too generic
  const isTooGeneric = documentText.split(/\s+/).length < 200 || 
                      !documentText.toLowerCase().includes('pia');
  
  if (isTooGeneric && context.type !== 'test_document') {
    immediateActionsSet.add('Add PIA-specific references and requirements to the document');
  }
  
  // Add critical findings as immediate actions (limit to top 3)
  const criticalFindings = findings
    .filter(f => f.severity === 'high')
    .slice(0, 3);
  
  criticalFindings.forEach(finding => {
    immediateActionsSet.add(finding.recommendation);
  });
  
  // Add medium severity findings as priority areas
  findings
    .filter(f => f.severity === 'medium')
    .forEach(finding => {
      priorityAreasSet.add(finding.category.replace('_', ' '));
    });
  
  // Generate section-specific recommendations (limit to avoid repetition)
  Object.entries(findingsBySection).slice(0, 10).forEach(([section, sectionFindings]) => {
    if (sectionFindings.length > 0) {
      const categories = [...new Set(sectionFindings.map(f => f.category.replace('_', ' ')))];
      const piaReferences = [...new Set(sectionFindings.map(f => f.piaReference))].slice(0, 3);
      
      if (categories.length > 0) {
        allRecommendationsSet.add(
          `Address ${categories.join(', ')} requirements in "${section}" section`
        );
      }
      
      if (piaReferences.length > 0) {
        allRecommendationsSet.add(
          `Reference ${piaReferences.join(', ')} in "${section}" section`
        );
      }
    }
  });
  
  // Generate category-specific recommendations (limit to avoid repetition)
  Object.entries(findingsByCategory).forEach(([category, categoryFindings]) => {
    if (categoryFindings.length > 0) {
      const complianceStatuses = [...new Set(categoryFindings.map(f => f.complianceStatus))];
      const formattedCategory = category.replace('_', ' ');
      
      if (complianceStatuses.includes('missing')) {
        allRecommendationsSet.add(`Add ${formattedCategory} framework to the document`);
      } else if (complianceStatuses.includes('non_compliant')) {
        allRecommendationsSet.add(`Strengthen ${formattedCategory} provisions`);
      } else if (complianceStatuses.includes('partial')) {
        allRecommendationsSet.add(`Add specific details to ${formattedCategory} section`);
      }
    }
  });
  
  // Add document-type specific recommendations
  if (context.type === 'test_document') {
    immediateActionsSet.add('For actual operations, convert test statements to specific legal requirements');
    allRecommendationsSet.add('Replace generic statements with PIA-specific requirements');
    allRecommendationsSet.add('Add specific percentages, timelines, and procedures');
    allRecommendationsSet.add('Reference actual PIA sections and requirements');
  } else {
    // Check for missing critical areas
    const criticalAreas = ['host_communities', 'environmental_protection', 'safety_health'];
    const missingCritical = criticalAreas.filter(area => 
      !findings.some(f => f.category === area && f.complianceStatus !== 'missing')
    );
    
    if (missingCritical.length > 0) {
      const formattedAreas = missingCritical.map(a => a.replace('_', ' ')).join(', ');
      immediateActionsSet.add(`Address missing critical PIA areas: ${formattedAreas}`);
    }
  }
  
  // Ensure we have priority areas
  if (priorityAreasSet.size === 0 && findings.length > 0) {
    // Get top 3 most common categories
    const categoryCounts: Record<string, number> = {};
    findings.forEach(f => {
      categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
    });
    
    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category.replace('_', ' '));
    
    topCategories.forEach(category => priorityAreasSet.add(category));
  }
  
  if (priorityAreasSet.size === 0) {
    priorityAreasSet.add('pia compliance framework');
  }
  
  // Add general recommendations
  allRecommendationsSet.add('Ensure all PIA requirements are specifically referenced');
  allRecommendationsSet.add('Include measurable and verifiable compliance indicators');
  allRecommendationsSet.add('Regularly review and update the document for PIA compliance');
  
  // Determine timeline
  let complianceTimeline: 'immediate_action_required' | 'short_term' | 'long_term';
  if (immediateActionsSet.size > 0) {
    complianceTimeline = 'immediate_action_required';
  } else if (allRecommendationsSet.size > 0) {
    complianceTimeline = 'short_term';
  } else {
    complianceTimeline = 'long_term';
  }
  
  // Convert sets to arrays and limit sizes
  const immediateActions = Array.from(immediateActionsSet).slice(0, 5);
  const priorityAreas = Array.from(priorityAreasSet).slice(0, 5);
  const allRecommendations = Array.from(allRecommendationsSet).slice(0, 15); // Limit to 15
  
  return {
    immediateActions: immediateActions.length > 0 ? 
      immediateActions : 
      ['Review document for comprehensive PIA compliance'],
    priorityAreas,
    complianceTimeline,
    allRecommendations: allRecommendations.length > 0 ? 
      allRecommendations : 
      ['Ensure document addresses all PIA requirements']
  };
};


const extractKeywords = (text: string): string[] => {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'which', 'shall', 'must']);
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  return [...new Set(words)].slice(0, 10); // Return top 10 unique keywords
};

const categorizePIASection = (sectionNumber: number, title: string, content: string): string => {
  const contentLower = content.toLowerCase();
  
  if (sectionNumber >= 234 && sectionNumber <= 257) return 'host_communities';
  if (sectionNumber >= 267 && sectionNumber <= 302) {
    if (contentLower.includes('royalty')) return 'royalty_payments';
    if (contentLower.includes('tax')) return 'taxation';
    return 'fiscal_framework';
  }
  if (sectionNumber >= 65 && sectionNumber <= 89) return 'licensing_administration';
  if (sectionNumber >= 104 && sectionNumber <= 105) return 'environmental_protection';
  if (sectionNumber === 106) return 'safety_health';
  if (contentLower.includes('report') || contentLower.includes('data')) return 'reporting';
  if (contentLower.includes('nigerian') && contentLower.includes('content')) return 'nigerian_content';
  if (contentLower.includes('governance') || contentLower.includes('board')) return 'governance';
  
  return 'general_provisions';
};

const determinePIAImportance = (sectionNumber: number, category: string, title: string): 'high' | 'medium' | 'low' => {
  const highImportanceSections = [234, 235, 303, 104, 105, 106]; // Key PIA sections
  const highImportanceCategories = ['host_communities', 'royalty_payments', 'environmental_protection', 'safety_health'];
  
  if (highImportanceSections.includes(sectionNumber) || highImportanceCategories.includes(category)) {
    return 'high';
  }
  if (category === 'licensing_administration' || category === 'taxation') {
    return 'medium';
  }
  return 'low';
};

const isKeySection = (sectionNumber: number, category: string): boolean => {
  return sectionNumber <= 20 || // Early sections
         category === 'host_communities' ||
         category === 'royalty_payments' ||
         category === 'environmental_protection';
};

const extractRelevantKeywords = (content: string, category: string): string[] => {
  const baseKeywords = extractKeywords(content);
  
  // Add category-specific keywords
  const categoryKeywords: { [key: string]: string[] } = {
    'host_communities': ['community', 'host', 'trust', 'development', '3%', 'opex', 'contribution'],
    'royalty_payments': ['royalty', 'payment', 'percent', '%', 'production', 'calculate'],
    'environmental_protection': ['environment', 'pollution', 'spill', 'remediation', 'monitor', 'impact'],
    'safety_health': ['safety', 'health', 'emergency', 'risk', 'procedure', 'hazard'],
    'licensing_administration': ['license', 'permit', 'regulatory', 'approval', 'authorization']
  };
  
  const specificKeywords = categoryKeywords[category] || [];
  return [...new Set([...baseKeywords, ...specificKeywords])].slice(0, 12);
};

const extractKeyRequirement = (content: string): string => {
  const sentences = content.split(/[.!?]+/);
  const requirementSentence = sentences.find(s => 
    s.includes('shall') || s.includes('must') || s.includes('required to')
  );
  
  return requirementSentence ? 
    requirementSentence.trim().replace(/\s+/g, ' ').substring(0, 120) : 
    content.substring(0, 100).trim().replace(/\s+/g, ' ') + '...';
};

const areProvisionsRelevant = (piaProv: any, sectionText: string, sectionTitle: string): boolean => {
  // Check keyword overlap
  const keywordOverlap = piaProv.keywords.filter((kw:any) => 
    sectionText.includes(kw) || sectionTitle.toLowerCase().includes(kw)
  ).length;
  
  // Check for category relevance
  const sectionCategory = determineSectionCategory(sectionTitle, sectionText);
  const isCategoryRelevant = sectionCategory === piaProv.category || 
                           areCategoriesRelated(sectionCategory, piaProv.category);
  
  return keywordOverlap > 0 || isCategoryRelevant;
};

const determineSectionCategory = (title: string, content: string): string => {
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  if (lowerTitle.includes('community') || lowerContent.includes('community')) return 'host_communities';
  if (lowerTitle.includes('environment') || lowerContent.includes('environment')) return 'environmental_protection';
  if (lowerTitle.includes('license') || lowerContent.includes('license')) return 'licensing_administration';
  if (lowerTitle.includes('safety') || lowerContent.includes('safety')) return 'safety_health';
  if (lowerTitle.includes('report') || lowerContent.includes('report')) return 'reporting';
  if (lowerTitle.includes('governance') || lowerContent.includes('governance')) return 'governance';
  if (lowerTitle.includes('royalty') || lowerContent.includes('royalty')) return 'royalty_payments';
  
  return 'general_provisions';
};

const areCategoriesRelated = (category1: string, category2: string): boolean => {
  const relatedGroups = [
    ['host_communities', 'social_responsibility'],
    ['environmental_protection', 'safety_health'],
    ['licensing_administration', 'governance'],
    ['reporting', 'compliance_monitoring']
  ];
  
  return relatedGroups.some(group => 
    group.includes(category1) && group.includes(category2)
  );
};

const calculateComprehensiveMatchScore = (piaProv: any, userSection: any): number => {
  let score = 0;
  const sectionText = (userSection.title + ' ' + userSection.content).toLowerCase();
  
  // Keyword match
  const keywordMatches = piaProv.keywords.filter((kw:any) => 
    sectionText.includes(kw.toLowerCase())
  ).length;
  
  score += (keywordMatches / Math.max(piaProv.keywords.length, 1)) * 0.4;
  
  // Requirement words
  const hasRequirementWords = /shall|must|required|will\s+implement|commits\s+to/i.test(userSection.content);
  if (hasRequirementWords) score += 0.3;
  
  // Specificity (numbers, percentages, specific terms)
  const hasSpecifics = /\d+%|\d+\s+(million|billion|percent)|specific|detailed/i.test(userSection.content);
  if (hasSpecifics) score += 0.2;
  
  // Section has requirements
  if (userSection.hasRequirements) score += 0.1;
  
  return Math.min(score, 1);
};

const determineComprehensiveCompliance = (piaProv: any, userSection: any, matchScore: number): 'compliant' | 'partial' | 'non_compliant' | 'missing' => {
  if (matchScore >= 0.6) return 'compliant';
  if (matchScore >= 0.3) return 'partial';
  return 'non_compliant';
};

const determineComprehensiveSeverity = (category: string, complianceStatus: string, context: any): 'high' | 'medium' | 'low' => {
  const highSeverityCategories = ['host_communities', 'royalty_payments', 'environmental_protection', 'safety_health'];
  
  if (complianceStatus === 'missing' || complianceStatus === 'non_compliant') {
    if (highSeverityCategories.includes(category) && context.type !== 'test_document') {
      return 'high';
    }
    return 'medium';
  }
  
  return 'low';
};

const generateComprehensiveAnalysisText = (piaProv: any, userSection: any, complianceStatus: string): string => {
  switch (complianceStatus) {
    case 'compliant':
      return `Section "${userSection.title}" properly addresses ${piaProv.category.replace('_', ' ')}`;
    case 'partial':
      return `Section "${userSection.title}" partially addresses ${piaProv.category.replace('_', ' ')} but lacks specifics`;
    case 'non_compliant':
      return `Section "${userSection.title}" inadequately addresses ${piaProv.category.replace('_', ' ')}`;
    default:
      return `PIA requirement not specifically addressed in section "${userSection.title}"`;
  }
};

const generateComprehensiveRecommendation = (piaProv: any, complianceStatus: string, userSection: any): string => {
  const sectionName = userSection.title || 'the document';
  const categoryName = piaProv.category.replace('_', ' ');
  const piaSection = piaProv.section;
  
  switch (complianceStatus) {
    case 'compliant':
      return `Maintain current approach for ${categoryName} in "${sectionName}"`;
    case 'partial':
      return `Add specific requirements from PIA Section ${piaSection} to "${sectionName}" for ${categoryName}`;
    case 'non_compliant':
      return `Revise "${sectionName}" to include PIA Section ${piaSection} requirements for ${categoryName}`;
    case 'missing':
      return `Add provisions for ${categoryName} (PIA Section ${piaSection}) to "${sectionName}"`;
    default:
      return `Address ${categoryName} requirements in "${sectionName}"`;
  }
};


const calculateComprehensiveScore = (findings: ComplianceFinding[], sectionCount: number, context: any): number => {
  if (findings.length === 0) {
    return context.type === 'test_document' ? 60 : 40;
  }
  
  let totalScore = 0;
  let maxScore = 0;
  
  findings.forEach(finding => {
    const weight = finding.severity === 'high' ? 3 : 
                   finding.severity === 'medium' ? 2 : 1;
    
    maxScore += weight;
    
    if (finding.complianceStatus === 'compliant') {
      totalScore += weight;
    } else if (finding.complianceStatus === 'partial') {
      totalScore += weight * 0.5;
    }
  });
  
  const baseScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  
  // Adjust based on document coverage
  const coverageBonus = Math.min(sectionCount * 2, 20);
  const adjustedScore = Math.min(baseScore + coverageBonus, 100);
  
  return Math.round(adjustedScore);
};

const generateComprehensiveSummary = (score: number, findingsCount: number, context: any): string => {
  if (context.type === 'test_document') {
    if (score >= 80) return 'Test document shows excellent PIA awareness';
    if (score >= 65) return 'Test document shows good PIA coverage';
    if (score >= 50) return 'Test document partially addresses PIA requirements';
    return 'Test document needs more PIA-specific content';
  }
  
  if (score >= 85) return 'Document demonstrates comprehensive PIA compliance';
  if (score >= 70) return 'Document shows strong PIA compliance with minor gaps';
  if (score >= 55) return 'Document has moderate PIA compliance with several areas for improvement';
  if (score >= 40) return 'Document has partial PIA compliance requiring significant work';
  return 'Document shows poor PIA compliance - major revisions needed';
};

const generateLightweightSummary = (score: number, context: any, findingsCount: number): string => {
  if (context.type === 'test_document') {
    if (findingsCount === 0) return 'Minimal test document analyzed';
    if (score >= 70) return 'Test document shows good awareness of key PIA areas';
    if (score >= 50) return 'Test document addresses some PIA requirements';
    return 'Test document needs more PIA coverage';
  }
  
  if (score >= 70) return 'Document shows good high-level PIA alignment';
  if (score >= 50) return 'Document partially addresses key PIA areas';
  if (score >= 30) return 'Document has limited PIA coverage';
  return 'Document needs substantial work to meet PIA requirements';
};

const generateStandardSummary = (score: number, context: any, findingsCount: number): string => {
  if (context.type === 'test_document') {
    return findingsCount > 0 ? 
      'Test document analyzed for PIA compliance' : 
      'Test document requires more PIA-specific content';
  }
  
  if (score >= 75) return 'Document demonstrates good PIA compliance';
  if (score >= 60) return 'Document shows moderate PIA compliance';
  if (score >= 45) return 'Document has partial PIA compliance';
  return 'Document shows inadequate PIA compliance';
};

const generateStandardRecommendation = (category: string, status: string): string => {
  const recommendations: { [key: string]: { [status: string]: string } } = {
    'host_communities': {
      'compliant': 'Maintain host community provisions',
      'partial': 'Specify 3% OPEX contribution and trust requirements',
      'missing': 'Add host community development trust provisions'
    },
    'environmental_protection': {
      'compliant': 'Maintain environmental protection measures',
      'partial': 'Add specific spill response and monitoring procedures',
      'missing': 'Implement comprehensive environmental management system'
    },
    'licensing_administration': {
      'compliant': 'Maintain licensing compliance procedures',
      'partial': 'Specify regulatory authority engagements and approvals',
      'missing': 'Establish licensing compliance framework'
    },
    'safety_health': {
      'compliant': 'Maintain health and safety standards',
      'partial': 'Add emergency response procedures and risk assessments',
      'missing': 'Implement comprehensive health and safety management system'
    }
  };
  
  return recommendations[category]?.[status] || `Address ${category.replace('_', ' ')} requirements`;
};

const generateLightweightRecommendations = (findings: ComplianceFinding[], context: any): Recommendations => {
  const immediateActions: string[] = [];
  const priorityAreas: string[] = [];
  const allRecommendations: string[] = [];
  
  if (context.type === 'test_document') {
    immediateActions.push('For actual operations, convert to specific legal requirements');
    allRecommendations.push(
      'Replace generic statements with PIA-specific requirements',
      'Add specific percentages, timelines, and procedures',
      'Reference actual PIA sections and requirements'
    );
  } else {
    findings.forEach(finding => {
      if (finding.severity === 'high' || finding.severity === 'medium') {
        immediateActions.push(finding.recommendation);
      }
      allRecommendations.push(finding.recommendation);
    });
  }
  
  // Add priority areas
  const highPriorityCategories = findings
    .filter(f => f.severity === 'high')
    .map(f => f.category);
  priorityAreas.push(...new Set(highPriorityCategories));
  
  if (priorityAreas.length === 0 && findings.length > 0) {
    priorityAreas.push(...new Set(findings.map(f => f.category).slice(0, 2)));
  }
  
  if (priorityAreas.length === 0) {
    priorityAreas.push('key_pia_areas');
  }
  
  // Determine timeline
  let complianceTimeline: 'immediate_action_required' | 'short_term' | 'long_term';
  if (immediateActions.length > 0) {
    complianceTimeline = 'immediate_action_required';
  } else if (allRecommendations.length > 0) {
    complianceTimeline = 'short_term';
  } else {
    complianceTimeline = 'long_term';
  }
  
  return {
    immediateActions: immediateActions.length > 0 ? immediateActions : ['Review document for PIA compliance'],
    priorityAreas,
    complianceTimeline,
    allRecommendations: allRecommendations.length > 0 ? allRecommendations : ['Ensure document addresses all PIA requirements']
  };
};

const generateComprehensiveRecommendations = (findings: ComplianceFinding[], context: any): Recommendations => {
  const immediateActions: string[] = [];
  const priorityAreas: string[] = [];
  const allRecommendations: string[] = [];
  
  // Categorize findings
  const highSeverityFindings = findings.filter(f => f.severity === 'high');
  const mediumSeverityFindings = findings.filter(f => f.severity === 'medium');
  
  // Immediate actions from high severity findings
  highSeverityFindings.slice(0, 3).forEach(finding => {
    immediateActions.push(finding.recommendation);
  });
  
  // Priority areas from high and medium severity findings
  const severityCategories = [...highSeverityFindings, ...mediumSeverityFindings]
    .map(f => f.category);
  priorityAreas.push(...new Set(severityCategories));
  
  // All recommendations
  findings.forEach(finding => {
    if (finding.complianceStatus !== 'compliant') {
      allRecommendations.push(finding.recommendation);
    }
  });
  
  // Add general recommendations if none specific
  if (allRecommendations.length === 0) {
    allRecommendations.push(
      'Document shows good PIA compliance',
      'Maintain current implementation',
      'Regularly review for PIA updates'
    );
  }
  
  // Determine timeline
  let complianceTimeline: 'immediate_action_required' | 'short_term' | 'long_term';
  if (highSeverityFindings.length > 0) {
    complianceTimeline = 'immediate_action_required';
  } else if (mediumSeverityFindings.length > 0) {
    complianceTimeline = 'short_term';
  } else {
    complianceTimeline = 'long_term';
  }
  
  // Ensure we have priority areas
  if (priorityAreas.length === 0 && findings.length > 0) {
    priorityAreas.push(...new Set(findings.map(f => f.category).slice(0, 3)));
  }
  
  if (priorityAreas.length === 0) {
    priorityAreas.push('pia_compliance');
  }
  
  return {
    immediateActions: immediateActions.length > 0 ? immediateActions : ['Review document completeness'],
    priorityAreas,
    complianceTimeline,
    allRecommendations
  };
};

const generateStandardRecommendations = (findings: ComplianceFinding[], context: any): Recommendations => {
  const recommendations = generateLightweightRecommendations(findings, context);
  
  // Adjust for standard documents
  if (context.type !== 'test_document' && recommendations.immediateActions.length === 0) {
    if (findings.some(f => f.complianceStatus === 'missing')) {
      recommendations.immediateActions.push('Address missing critical PIA requirements');
    }
  }
  
  return recommendations;
};

const generateEmptyDocumentAnalysis = (): any => {
  return {
    overview: {
      complianceScore: 0,
      summary: 'Document is empty or contains insufficient content for compliance analysis',
      totalProvisionsAnalyzed: 0,
      majorComplianceAreas: []
    },
    detailedFindings: [],
    riskAssessment: {
      highRiskIssues: 0,
      mediumRiskIssues: 0,
      lowRiskIssues: 0,
      overallRisk: 'low'
    },
    recommendations: {
      immediateActions: ['Upload a document with substantive content for analysis'],
      priorityAreas: ['document_completeness'],
      complianceTimeline: 'immediate_action_required',
      allRecommendations: ['Provide a document with meaningful content for PIA compliance analysis']
    }
  };
};



export const getComparisonHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any).id;
    const { page = 1, limit = 10 } = req.query;

    const comparisons = await prisma.searchHistory.findMany({
      where: { 
        userId,
        query: { contains: 'Compliance Check' }
      },
      include: {
        document: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.searchHistory.count({ 
      where: { 
        userId,
        query: { contains: 'Compliance Check' }
      } 
    });

    sendSuccessResponse(res, 'Comparison history retrieved', {
      comparisons,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getComparisonResult = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { comparisonId } = req.params;
    const userId = (req.user as any).id;

    const comparison = await prisma.searchHistory.findFirst({
      where: { 
        id: comparisonId,
        userId 
      },
      include: {
        document: {
          select: { id: true, title: true }
        }
      }
    });

    if (!comparison) {
      throw new NotFoundError('Comparison result not found');
    }

    sendSuccessResponse(res, 'Comparison result retrieved', {
      comparison
    });
  } catch (error) {
    next(error);
  }
};





// import { NextFunction, Request, Response } from 'express';
// import prisma from '../prisma';
// import { sendSuccessResponse } from '../utils/sendSuccessResponse';
// import { NotFoundError } from '../errors/NotFoundError';
// import { BadRequestError } from '../errors/BadRequestError';
// import { upload } from '../config/multer';
// import { OpenAI } from 'openai';
// import { extractTextFromFile } from '../utils/fileExtractors';
// import { TextProcessor } from '../utils/textProcessor';

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });



// export const compareWithPIADocument = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     console.log('=== STARTING DOCUMENT COMPARISON ===');
//     console.log('Comparison file:', req.file);
//     console.log('Comparison body:', req.body);

//     if (!req.file) {
//          console.log('❌ No file uploaded');
//       return next(new BadRequestError('No file uploaded'));
//     }

//     const userId = (req.user as any).id;
//      console.log('👤 User ID:', userId);
//     where: { 
//         OR: [
//         { title: { contains: 'Petroleum Industry Act', mode: 'insensitive' } },
//         { title: { contains: 'PIA', mode: 'insensitive' } },
//         { id: 'cmgxc7pat0001t1vk8l3y40nx' } 
//         ]
//       };
//     // Get the latest PIA document from database
//     const piaDocument = await prisma.document.findFirst({
      
//       orderBy: { uploadedAt: 'desc' },
//       include: {
//         chunks: {
//           select: {
//             id: true,
//             chapter: true,
//             content: true,
//             pageNumber: true
//           }
//         }
//       }
//     });

//     if (!piaDocument) {
//       throw new NotFoundError('PIA document not found. Please try again later.');
//     }

//     // Extract text from uploaded document
//     let extractedData;
//     try {
//       extractedData = await extractTextFromFile(
//         req.file.buffer,
//         req.file.originalname,
//         req.file.mimetype
//       );
//       console.log('User document text extraction successful, length:', extractedData.text.length);
//     } catch (error) {
//         const errorMessage = (error instanceof Error) ? error.message : String(error);
//         console.error('❌ Text extraction failed:', errorMessage);
        
//         // More specific error messages
//         if (errorMessage.includes('bad XRef entry') || errorMessage.includes('PDF')) {
//             return next(new BadRequestError(
//             `The PDF file appears to be corrupted or invalid. Please try a different file or convert it to Word format.`
//             ));
//         }
    
//         return next(new BadRequestError(`Failed to process file: ${errorMessage}`));
//     }

//     // Process and clean the uploaded document text
//     const processedUserContent = TextProcessor.processRawText(
//       extractedData.text,
//       req.file.originalname
//     );

//     // Remove introduction and focus on legal content
//     const legalContent = extractLegalContent(processedUserContent.rawText);

//     // Compare with PIA document using AI
//     const comparisonResult = await compareDocumentsWithAI(
//       legalContent,
//       piaDocument,
//       req.file.originalname
//     );

//     // Store comparison result in database (optional)
//     const comparisonRecord = await prisma.searchHistory.create({
//       data: {
//         query: `Document Comparison: ${req.file.originalname} with PIA`,
//         results: comparisonResult,
//         documentId: piaDocument.id,
//         userId: userId,
//       },
//     });

//     sendSuccessResponse(
//       res,
//       'Document comparison completed successfully',
//       {
//         comparison: comparisonResult,
//         userDocument: {
//           filename: req.file.originalname,
//           totalSections: processedUserContent.metadata.sectionCount,
//           wordCount: processedUserContent.metadata.wordCount
//         },
//         piaDocument: {
//           title: piaDocument.title,
//           uploadedAt: piaDocument.uploadedAt
//         },
//         comparisonId: comparisonRecord.id
//       }
//     );
//   } catch (error) {
//     console.error('Comparison error:', error);
//     next(error);
//   }
// };





// const extractLegalContent = (text: string): string => {
//   // Common introduction patterns to ignore
//   const introductionPatterns = [
//     /introduction[\s\S]{1,2000}?(?=chapter|section|part|article)/gi,
//     /preamble[\s\S]{1,2000}?(?=chapter|section|part|article)/gi,
//     /preface[\s\S]{1,2000}?(?=chapter|section|part|article)/gi,
//     /background[\s\S]{1,2000}?(?=chapter|section|part|article)/gi,
//     /^[\s\S]{0,3000}?(?=CHAPTER|PART|SECTION|ARTICLE)/i
//   ];

//   let legalText = text;

//   // Remove introduction sections
//   introductionPatterns.forEach(pattern => {
//     legalText = legalText.replace(pattern, '');
//   });

//   // Focus on sections that contain legal provisions
//   const legalSectionPatterns = [
//     /(CHAPTER|PART|SECTION|ARTICLE|CLAUSE)\s+[IVXLCDM0-9A-Z]+[^a-z]{0,200}/gi,
//     /(\d+\.\s*[A-Z][^\n]{10,200})/g,
//     /(\([a-z]\)\s*[A-Z][^\n]{10,200})/gi
//   ];

//   let legalSections: string[] = [];
//   legalSectionPatterns.forEach(pattern => {
//     const matches = legalText.match(pattern) || [];
//     legalSections = legalSections.concat(matches);
//   });

//   // If we found specific legal sections, use them; otherwise use the cleaned text
//   if (legalSections.length > 0) {
//     return legalSections.join('\n\n');
//   }

//   return legalText;
// };





// const compareDocumentsWithAI = async (
//   userDocumentText: string,
//   piaDocument: any,
//   userFileName: string
// ): Promise<any> => {
//   try {
//     // Prepare PIA content for comparison (limit to avoid token limits)
//     const piaContent = piaDocument.chunks
//       .map((chunk: any) => `[${chunk.chapter}, Page ${chunk.pageNumber}]: ${chunk.content}`)
//       .join('\n\n')
//       .substring(0, 12000);

//     const userContent = userDocumentText.substring(0, 8000);

//     const comparisonPrompt = `
//       COMPARE LEGAL DOCUMENTS TASK:
      
//       You are comparing a user-uploaded document with the Petroleum Industry Act (PIA).
      
//       PIA DOCUMENT CONTEXT:
//       ${piaContent}
      
//       USER DOCUMENT CONTENT (focus on legal provisions, introductions removed):
//       ${userContent}
      
//       ANALYSIS INSTRUCTIONS:
//       1. Identify any written laws, regulations, or legal provisions in the user document
//       2. Compare them with the PIA document
//       3. Check for:
//          - Compliance with PIA provisions
//          - Conflicts with PIA requirements
//          - Gaps where user document doesn't address PIA requirements
//          - Areas where user document aligns well with PIA
//       4. Ignore introductory text, focus only on substantive legal content
//       5. Provide specific section references where possible
      
//       Return your analysis in this JSON format:
//       {
//         "summary": "Overall compliance assessment",
//         "complianceScore": 0-100,
//         "keyFindings": [
//           {
//             "type": "compliance|conflict|gap|alignment",
//             "description": "Specific finding",
//             "userDocumentReference": "Reference in user document",
//             "piaReference": "Relevant PIA section",
//             "severity": "high|medium|low"
//           }
//         ],
//         "recommendations": [
//           "Specific recommendations for alignment"
//         ]
//       }
//     `;

//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a legal document analysis expert specializing in petroleum industry regulations. Analyze documents objectively and provide specific, actionable findings."
//         },
//         {
//           role: "user",
//           content: comparisonPrompt
//         }
//       ],
//       max_tokens: 2000,
//       temperature: 0.1,
//     });

//     const aiResponse = response.choices[0]?.message?.content;
    
//     if (!aiResponse) {
//       throw new Error('AI comparison failed');
//     }

//     // Parse JSON response
//     try {
//       return JSON.parse(aiResponse);
//     } catch (parseError) {
//       console.error('Failed to parse AI response as JSON:', parseError);
//       // Fallback to structured text response
//       return {
//         summary: "Analysis completed but could not parse detailed results",
//         complianceScore: 0,
//         keyFindings: [],
//         recommendations: ["Please review the document manually for complete analysis"],
//         rawResponse: aiResponse
//       };
//     }

//   } catch (error) {
//     console.error('Error in AI comparison:', error);
//     return {
//       summary: "Automated analysis failed",
//       complianceScore: 0,
//       keyFindings: [
//         {
//           type: "error",
//           description: "Could not complete automated analysis",
//           severity: "high"
//         }
//       ],
//       recommendations: ["Please review the document manually"]
//     };
//   }
// };






// export const getComparisonHistory = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const userId = (req.user as any).id;
//     const { page = 1, limit = 10 } = req.query;

//     const comparisons = await prisma.searchHistory.findMany({
//       where: { 
//         userId,
//         query: { contains: 'Document Comparison' }
//       },
//       include: {
//         document: {
//           select: { id: true, title: true }
//         }
//       },
//       orderBy: { createdAt: 'desc' },
//       skip: (Number(page) - 1) * Number(limit),
//       take: Number(limit),
//     });

//     const total = await prisma.searchHistory.count({ 
//       where: { 
//         userId,
//         query: { contains: 'Document Comparison' }
//       } 
//     });

//     sendSuccessResponse(res, 'Comparison history retrieved', {
//       comparisons,
//       pagination: {
//         page: Number(page),
//         limit: Number(limit),
//         total,
//         pages: Math.ceil(total / Number(limit))
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };





// export const getComparisonResult = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { comparisonId } = req.params;
//     const userId = (req.user as any).id;

//     const comparison = await prisma.searchHistory.findFirst({
//       where: { 
//         id: comparisonId,
//         userId 
//       },
//       include: {
//         document: {
//           select: { id: true, title: true }
//         }
//       }
//     });

//     if (!comparison) {
//       throw new NotFoundError('Comparison result not found');
//     }

//     sendSuccessResponse(res, 'Comparison result retrieved', {
//       comparison
//     });
//   } catch (error) {
//     next(error);
//   }
// };