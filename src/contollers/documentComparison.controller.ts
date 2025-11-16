// Interface definitions for type safety
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
    } catch (aiError) {
    //   console.log('🔄 AI analysis failed, using local fallback:', aiError.message);
      analysisMethod = 'local_analysis';
      comparisonResult = performLocalComplianceAnalysis(legalContent, piaDocument);
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
            totalSections: processedUserContent.metadata.sectionCount,
            wordCount: processedUserContent.metadata.wordCount,
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
 * Extract legal content by removing introductions and focusing on substantive content
 */
const extractLegalContent = (text: string): string => {
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

  return legalText;
};

/**
 * AI-Powered Document Comparison (Primary Method)
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
    .substring(0, 15000); // Limit to avoid token limits

  const userContent = userDocumentText.substring(0, 10000);

  const analysisPrompt = `
    LEGAL DOCUMENT COMPLIANCE ANALYSIS

    TASK: Analyze how well the user's document complies with the Petroleum Industry Act (PIA) 2021.

    PIA DOCUMENT (Reference Standard):
    ${piaContent}

    USER DOCUMENT (To Analyze):
    ${userContent}

    ANALYSIS REQUIREMENTS:

    1. IDENTIFY LEGAL PROVISIONS:
    - Extract all legal obligations, requirements, and provisions from user document
    - Ignore introductory, explanatory, or non-binding text
    - Focus only on substantive legal content

    2. COMPLIANCE ASSESSMENT:
    For each identified provision in user document:
    - Check if it aligns with PIA requirements
    - Identify conflicts with PIA
    - Find gaps where PIA requirements are missing
    - Note areas of good alignment

    3. KEY COMPLIANCE AREAS TO CHECK:
    - Reporting frequency and requirements
    - Royalty calculations and payments
    - Licensing and permit requirements
    - Host community development obligations
    - Environmental protection measures
    - Health and safety requirements
    - Transparency and disclosure obligations
    - Fiscal provisions and tax compliance

    4. OUTPUT FORMAT (Valid JSON only):
    {
      "overview": {
        "complianceScore": 0-100,
        "summary": "Overall compliance assessment",
        "totalProvisionsAnalyzed": number,
        "majorComplianceAreas": ["area1", "area2"]
      },
      "detailedFindings": [
        {
          "category": "reporting|royalties|licensing|host_communities|environment|safety|transparency|fiscal",
          "provision": "Specific legal requirement from user document",
          "complianceStatus": "compliant|partial|non_compliant|missing",
          "piaReference": "Relevant PIA section with chapter/page",
          "analysis": "Detailed explanation of compliance status",
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
        "complianceTimeline": "immediate_action_required|short_term|long_term"
      }
    }

    IMPORTANT: 
    - Be specific and reference actual PIA sections
    - Provide actionable recommendations
    - Return valid JSON only, no additional text
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are a senior legal compliance analyst specializing in Nigerian petroleum industry regulations. 
        Provide accurate, specific, and actionable compliance analysis. Focus only on substantive legal provisions.
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
};

/**
 * Local Compliance Analysis (Fallback Method)
 * Uses database chunks for rule-based analysis
 */
const performLocalComplianceAnalysis = (userDocumentText: string, piaDocument: any): any => {
  console.log('🔍 Performing local compliance analysis using database chunks');
  
  const userText = userDocumentText.toLowerCase();
  const findings: ComplianceFinding[] = [];
  let totalScore = 0;
  let analyzedRequirements = 0;

  // Use the actual PIA chunks from database
  const piaChunks = piaDocument.chunks || [];
  console.log(`📊 Analyzing against ${piaChunks.length} PIA chunks from database`);

  // Define compliance requirements with specific checks
  const complianceRequirements: ComplianceRequirement[] = [
    {
      category: 'reporting_frequency',
      description: 'Production reporting frequency',
      piaKeywords: ['monthly', 'report', 'production', 'data', 'submit'],
      userKeywords: ['report', 'submit', 'production', 'data'],
      weight: 15,
      checkCompliance: (userDoc: string, piaChunks: any[]) => {
        const hasMonthlyReporting = piaChunks.some(chunk => 
          chunk.content.toLowerCase().includes('monthly') && 
          chunk.content.toLowerCase().includes('report')
        );
        
        const userHasMonthly = userDoc.includes('monthly') && userDoc.includes('report');
        const userHasAnnual = userDoc.includes('annual') && userDoc.includes('report');
        
        if (userHasAnnual && hasMonthlyReporting) {
          return {
            compliant: false,
            analysis: 'PIA requires monthly reporting, but document specifies annual reporting',
            piaReference: findRelevantChunk(piaChunks, ['monthly', 'report']),
            severity: 'high'
          };
        }
        
        if (userHasMonthly && hasMonthlyReporting) {
          return {
            compliant: true,
            analysis: 'Monthly reporting requirement properly implemented',
            piaReference: findRelevantChunk(piaChunks, ['monthly', 'report']),
            severity: 'low'
          };
        }
        
        return {
          compliant: false,
          analysis: 'Reporting frequency requirements not clearly specified',
          piaReference: 'PIA reporting provisions',
          severity: 'medium'
        };
      }
    },
    {
      category: 'royalty_payments',
      description: 'Royalty calculation and payment frequency',
      piaKeywords: ['royalty', 'payment', 'monthly', 'calculate', 'remit'],
      userKeywords: ['royalty', 'payment', 'calculate'],
      weight: 15,
      checkCompliance: (userDoc: string, piaChunks: any[]) => {
        const hasRoyaltyProvisions = piaChunks.some(chunk => 
          chunk.content.toLowerCase().includes('royalty')
        );
        
        const userHasRoyalty = userDoc.includes('royalty');
        const userHasMonthly = userDoc.includes('monthly') && userDoc.includes('royalty');
        
        if (!userHasRoyalty && hasRoyaltyProvisions) {
          return {
            compliant: false,
            analysis: 'Royalty payment provisions missing from document',
            piaReference: findRelevantChunk(piaChunks, ['royalty']),
            severity: 'high'
          };
        }
        
        if (userHasMonthly && hasRoyaltyProvisions) {
          return {
            compliant: true,
            analysis: 'Monthly royalty payments properly specified',
            piaReference: findRelevantChunk(piaChunks, ['royalty']),
            severity: 'low'
          };
        }
        
        return {
          compliant: userHasRoyalty,
          analysis: userHasRoyalty ? 'Royalty mentioned but frequency unclear' : 'Royalty provisions missing',
          piaReference: 'PIA royalty sections',
          severity: userHasRoyalty ? 'medium' : 'high'
        };
      }
    },
    {
      category: 'host_community_contribution',
      description: 'Host community development trust contributions',
      piaKeywords: ['host community', '3%', 'contribution', 'opex', 'development trust'],
      userKeywords: ['host community', 'contribution', 'opex', 'trust'],
      weight: 20,
      checkCompliance: (userDoc: string, piaChunks: any[]) => {
        const hasHostCommunityReq = piaChunks.some(chunk => 
          chunk.content.toLowerCase().includes('host community') && 
          (chunk.content.includes('3%') || chunk.content.includes('three percent'))
        );
        
        const userHasHostCommunity = userDoc.includes('host community');
        const userHas1Percent = userDoc.includes('1 percent') || userDoc.includes('1%');
        const userHas3Percent = userDoc.includes('3 percent') || userDoc.includes('3%');
        
        if (!userHasHostCommunity && hasHostCommunityReq) {
          return {
            compliant: false,
            analysis: 'Host community development trust requirements completely missing',
            piaReference: findRelevantChunk(piaChunks, ['host community']),
            severity: 'high'
          };
        }
        
        if (userHas1Percent && hasHostCommunityReq) {
          return {
            compliant: false,
            analysis: 'Host community contribution should be 3% of OPEX, not 1%',
            piaReference: findRelevantChunk(piaChunks, ['host community', '3%']),
            severity: 'high'
          };
        }
        
        if (userHas3Percent && hasHostCommunityReq) {
          return {
            compliant: true,
            analysis: '3% OPEX contribution to host communities properly specified',
            piaReference: findRelevantChunk(piaChunks, ['host community', '3%']),
            severity: 'low'
          };
        }
        
        return {
          compliant: false,
          analysis: 'Host community contribution requirements not properly specified',
          piaReference: 'PIA host community provisions',
          severity: 'medium'
        };
      }
    },
    {
      category: 'environmental_protection',
      description: 'Environmental management and spill response',
      piaKeywords: ['environment', 'spill', 'immediate', 'response', 'audit', 'remediation'],
      userKeywords: ['environment', 'spill', 'response', 'audit'],
      weight: 15,
      checkCompliance: (userDoc: string, piaChunks: any[]) => {
        const hasSpillResponse = piaChunks.some(chunk => 
          chunk.content.toLowerCase().includes('spill') && 
          chunk.content.toLowerCase().includes('immediate')
        );
        
        const userHasSpill = userDoc.includes('spill');
        const userHasImmediate = userDoc.includes('immediate') && userDoc.includes('spill');
        const userHasDelayed = (userDoc.includes('days') || userDoc.includes('10 days')) && userDoc.includes('spill');
        
        if (userHasDelayed && hasSpillResponse) {
          return {
            compliant: false,
            analysis: 'Spill response should be immediate, not delayed (e.g., 10 days)',
            piaReference: findRelevantChunk(piaChunks, ['spill', 'immediate']),
            severity: 'high'
          };
        }
        
        if (userHasImmediate && hasSpillResponse) {
          return {
            compliant: true,
            analysis: 'Immediate spill response properly specified',
            piaReference: findRelevantChunk(piaChunks, ['spill', 'immediate']),
            severity: 'low'
          };
        }
        
        return {
          compliant: userHasSpill,
          analysis: userHasSpill ? 'Spill response mentioned but timing unclear' : 'Spill response provisions missing',
          piaReference: 'PIA environmental protection sections',
          severity: userHasSpill ? 'medium' : 'high'
        };
      }
    },
    {
      category: 'licensing_approvals',
      description: 'License transfers and regulatory approvals',
      piaKeywords: ['license', 'approval', 'transfer', 'prior', 'regulatory'],
      userKeywords: ['license', 'approval', 'transfer'],
      weight: 10,
      checkCompliance: (userDoc: string, piaChunks: any[]) => {
        const hasApprovalReq = piaChunks.some(chunk => 
          chunk.content.toLowerCase().includes('license') && 
          chunk.content.toLowerCase().includes('approval')
        );
        
        const userHasLicense = userDoc.includes('license');
        const userHasWithoutApproval = userDoc.includes('without approval') && userDoc.includes('transfer');
        
        if (userHasWithoutApproval && hasApprovalReq) {
          return {
            compliant: false,
            analysis: 'License transfers require prior regulatory approval',
            piaReference: findRelevantChunk(piaChunks, ['license', 'approval']),
            severity: 'high'
          };
        }
        
        if (userHasLicense && !userHasWithoutApproval && hasApprovalReq) {
          return {
            compliant: true,
            analysis: 'License transfer approval requirements properly addressed',
            piaReference: findRelevantChunk(piaChunks, ['license', 'approval']),
            severity: 'low'
          };
        }
        
        return {
          compliant: false,
          analysis: 'License transfer provisions not clearly specified',
          piaReference: 'PIA licensing sections',
          severity: 'medium'
        };
      }
    }
  ];

  // Analyze each compliance requirement
  complianceRequirements.forEach(requirement => {
    const result = requirement.checkCompliance(userText, piaChunks);
    
    if (result) {
      analyzedRequirements++;
      
      const finding:ComplianceFinding = {
        category: requirement.category,
        provision: requirement.description,
        complianceStatus: result.compliant ? 'compliant' : 'non_compliant',
        piaReference: result.piaReference,
        analysis: result.analysis,
        severity: result.severity,
        recommendation: generateRecommendation(requirement.category, result.compliant, result.analysis)
      };
      
      findings.push(finding);
      
      // Calculate score contribution
      if (result.compliant) {
        totalScore += requirement.weight;
      } else {
        // Partial score based on severity
        const severityMultiplier = result.severity === 'high' ? 0.2 : 
                                 result.severity === 'medium' ? 0.5 : 0.8;
        totalScore += requirement.weight * severityMultiplier;
      }
    }
  });

  // Calculate overall compliance score
  const maxPossibleScore = complianceRequirements.reduce((sum, req) => sum + req.weight, 0);
  const complianceScore = analyzedRequirements > 0 ? 
    Math.round((totalScore / maxPossibleScore) * 100) : 0;

  // Risk assessment
  const riskCount = {
    high: findings.filter(f => f.severity === 'high' && f.complianceStatus === 'non_compliant').length,
    medium: findings.filter(f => f.severity === 'medium' && f.complianceStatus === 'non_compliant').length,
    low: findings.filter(f => f.severity === 'low' && f.complianceStatus === 'non_compliant').length
  };

  const overallRisk = riskCount.high >= 2 ? 'high' : 
                     riskCount.high >= 1 ? 'medium' : 
                     riskCount.medium >= 2 ? 'medium' : 'low';

  // Generate recommendations
  const immediateActions = findings
    .filter(f => f.severity === 'high' && f.complianceStatus === 'non_compliant')
    .map(f => f.recommendation);

  const priorityAreas = [...new Set(
    findings
      .filter(f => f.severity === 'high' && f.complianceStatus === 'non_compliant')
      .map(f => f.category)
  )];

  return {
    overview: {
      complianceScore: complianceScore,
      summary: generateSummary(complianceScore, riskCount),
      totalProvisionsAnalyzed: findings.length,
      majorComplianceAreas: [...new Set(findings.map(f => f.category))]
    },
    detailedFindings: findings,
    riskAssessment: {
      highRiskIssues: riskCount.high,
      mediumRiskIssues: riskCount.medium,
      lowRiskIssues: riskCount.low,
      overallRisk: overallRisk
    },
    recommendations: {
      immediateActions: immediateActions,
      priorityAreas: priorityAreas,
      complianceTimeline: overallRisk === 'high' ? 'immediate_action_required' : 
                         overallRisk === 'medium' ? 'short_term' : 'long_term',
      allRecommendations: findings.map(f => f.recommendation)
    }
  };
};

/**
 * Helper function to find relevant PIA chunks
 */
const findRelevantChunk = (chunks: any[], keywords: string[]): string => {
  const relevantChunk = chunks.find(chunk => 
    keywords.some(keyword => chunk.content.toLowerCase().includes(keyword))
  );
  
  if (relevantChunk) {
    return `${relevantChunk.chapter} (Page ${relevantChunk.pageNumber})`;
  }
  
  return 'PIA relevant provisions';
};

/**
 * Generate specific recommendations based on findings
 */
const generateRecommendation = (category: string, isCompliant: boolean, analysis: string): string => {
  if (isCompliant) {
    return 'Maintain current implementation';
  }

  const recommendations: { [key: string]: string } = {
    reporting_frequency: 'Update reporting frequency from annual to monthly as per PIA requirements',
    royalty_payments: 'Implement monthly royalty payment system with accurate calculation methods',
    host_community_contribution: 'Increase host community contribution to 3% of annual OPEX',
    environmental_protection: 'Implement immediate spill response procedures and regular environmental monitoring',
    licensing_approvals: 'Require prior regulatory approval for all license transfers and assignments',
    environmental_audits: 'Conduct annual environmental audits instead of extended intervals'
  };

  return recommendations[category] || `Address compliance gap in ${category} area`;
};

/**
 * Generate summary based on score and risk
 */
const generateSummary = (score: number, riskCount: any): string => {
  if (score >= 80) {
    return 'Document demonstrates strong compliance with PIA requirements';
  } else if (score >= 60) {
    return 'Document shows good compliance with some areas needing improvement';
  } else if (score >= 40) {
    return 'Document has partial compliance with several significant gaps';
  } else {
    return 'Document has major compliance gaps requiring immediate attention';
  }
};

// Export other functions
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