import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { BadRequestError } from '../errors/BadRequestError';
import { NotFoundError } from '../errors/NotFoundError';
import { OpenAI } from 'openai';
import { extractTextFromFile } from '../utils/fileExtractors';
import { TextProcessor } from '../utils/textProcessor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
  description: string;
}

interface TaxRules {
  hasProgressiveRates: boolean;
  brackets: TaxBracket[];
  personalRelief?: number;
  minimumWage?: number;
  companyRate?: number;
  smallCompanyThreshold?: number;
  developmentLevy?: number;
}

interface ExtractedInfo {
  income?: number;
  isCompany?: boolean;
  queryType: string;
  rawQuery: string;
}

interface DocumentQuestion {
  text: string;
  type: 'explicit' | 'implied' | 'calculation';
  confidence: 'high' | 'medium' | 'low';
  extractedInfo?: ExtractedInfo;
}

export const queryNigeriaTaxAct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { query } = req.body;
    const userId = (req.user as any).id;

    if (!query || query.trim().length < 3) {
      throw new BadRequestError('Please provide a valid query');
    }

    // console.log(`📝 Processing tax query: "${query}"`);

    const taxActDocument = await prisma.document.findFirst({
      where: {
        OR: [
          { title: { contains: 'Nigeria Tax Act', mode: 'insensitive' } },
          { title: { contains: 'NIGERIA TAX ACT', mode: 'insensitive' } },
          { title: { contains: 'Tax Act', mode: 'insensitive' } }
        ]
      },
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

    if (!taxActDocument) {
      throw new NotFoundError('Nigeria Tax Act document not found. Please upload the document first.');
    }

    // console.log(`📚 Document found with ${taxActDocument.chunks?.length || 0} chunks`);
    const extractedInfo = extractInfoFromQuery(query);
    // console.log('🔍 Extracted info:', extractedInfo);
    const isCalculationQuery = 
      query.toLowerCase().includes('how much') || 
      query.toLowerCase().includes('calculate') || 
      query.toLowerCase().includes('tax on') || 
      query.toLowerCase().includes('pay on') ||
      query.toLowerCase().includes('what.*tax') ||
      (extractedInfo.income !== undefined && extractedInfo.income > 0);

    if (extractedInfo.income && (extractedInfo.queryType === 'calculation' || extractedInfo.queryType === 'eligibility' || isCalculationQuery)) {

      const taxRules = await extractTaxRulesFromDocument(taxActDocument, extractedInfo.isCompany);
    
      const result = calculateTax(extractedInfo, taxRules);
      const searchHistory = await prisma.searchHistory.create({
        data: {
          query: query.substring(0, 200),
          results: {
            query,
            result,
            timestamp: new Date().toISOString(),
            source: 'tax_query'
          },
          documentId: taxActDocument.id,
          userId,
        },
      });

      sendSuccessResponse(res, 'Tax query completed successfully', {
        result,
        queryId: searchHistory.id
      });
      return;
    }

    console.log('📖 Processing as general query...');
    const result = await answerGeneralQuery(query, taxActDocument);

    const searchHistory = await prisma.searchHistory.create({
      data: {
        query: query.substring(0, 200),
        results: {
          query,
          result,
          timestamp: new Date().toISOString(),
          source: 'tax_query'
        },
        documentId: taxActDocument.id,
        userId,
      },
    });

    sendSuccessResponse(res, 'Tax query completed successfully', {
      result,
      queryId: searchHistory.id
    });

  } catch (error) {
    console.error('Tax query error:', error);
    next(error);
  }
};


const extractInfoFromQuery = (query: string): ExtractedInfo => {
  const lowerQuery = query.toLowerCase();
  
  let income: number | undefined = undefined;
  
  const incomePatterns = [
    /(?:N|₦)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(million|m|thousand|k|mille)?/i,
    /(\d+(?:,\d+)*(?:\.\d+)?)\s*(million|m|thousand|k|mille)?/i
  ];
  
  for (const pattern of incomePatterns) {
    const match = query.match(pattern);
    if (match) {
      let amount = parseFloat(match[1].replace(/,/g, ''));
      const unit = match[2]?.toLowerCase();
      
      if (unit === 'million' || unit === 'm' || unit === 'mille') {
        amount *= 1000000;
      } else if (unit === 'thousand' || unit === 'k') {
        amount *= 1000;
      }
      income = amount;
      break;
    }
  }
  
  if (!income) {
    const numberMatch = query.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    if (numberMatch) {
      const num = parseFloat(numberMatch[1].replace(/,/g, ''));
      income = num;
    }
  }
  
  let isCompany: boolean | undefined = undefined;
  if (lowerQuery.includes('company') || lowerQuery.includes('business') || lowerQuery.includes('corporate') || lowerQuery.includes('ltd') || lowerQuery.includes('limited')) {
    isCompany = true;
  } else if (lowerQuery.includes('individual') || lowerQuery.includes('person') || lowerQuery.includes('employee') || lowerQuery.includes('i earn') || lowerQuery.includes('my income') || lowerQuery.includes('freelancer')) {
    isCompany = false;
  }
  
  let queryType = 'general';
  if (lowerQuery.includes('how much') || lowerQuery.includes('calculate') || lowerQuery.includes('pay on') || lowerQuery.includes('tax on')) {
    queryType = 'calculation';
  } else if (lowerQuery.includes('need to pay') || lowerQuery.includes('required') || lowerQuery.includes('eligible') || lowerQuery.includes('do i')) {
    queryType = 'eligibility';
  } else if (lowerQuery.includes('vat') || lowerQuery.includes('value added tax')) {
    queryType = 'vat';
  } else if (lowerQuery.includes('deduct') || lowerQuery.includes('expense') || lowerQuery.includes('claim')) {
    queryType = 'deduction';
  } else if (lowerQuery.includes('rate') || lowerQuery.includes('percentage') || lowerQuery.includes('%')) {
    queryType = 'rate';
  } else if (lowerQuery.includes('deadline') || lowerQuery.includes('file') || lowerQuery.includes('due') || lowerQuery.includes('submit')) {
    queryType = 'deadline';
  }
  
  return { income, isCompany, queryType, rawQuery: query };
};

const calculateTax = (info: ExtractedInfo, rules: TaxRules | null): any => {
  const { income, isCompany } = info;
  
  if (!income) {
    return {
      answer: "I need your income amount to calculate tax. Please provide your annual income.",
      needsMoreInfo: true,
      confidence: "low"
    };
  }

  if (!rules) {
    return calculateTaxWithStandardRates(info);
  }

  return calculateTaxWithRules(info, rules);
};


const calculateTaxWithStandardRates = (info: ExtractedInfo): any => {
  const { income, isCompany } = info;
  
  if (!income) {
    return {
      answer: "Income amount is required for tax calculation.",
      confidence: "low"
    };
  }

  if (isCompany === true) {
    const companyRate = 0.30;
    const smallCompanyThreshold = 100000000; 
    const developmentLevy = 0.04; 
    
    if (income <= smallCompanyThreshold) {
      const levy = income * developmentLevy;
      
      return {
        answer: `Based on the Nigeria Tax Act, as a **small company** with turnover of **N${income.toLocaleString()}**, you qualify for the small company tax rate of **0%**.\n\nHowever, you still need to pay development levy of **4%** which amounts to **N${Math.round(levy).toLocaleString()}**.\n\n**Total Tax Payable: N${Math.round(levy).toLocaleString()}**`,
        eligible: true,
        taxAmount: Math.round(levy),
        breakdown: [
          {
            description: "Companies Income Tax (Small Company Rate)",
            amount: income,
            rate: "0%",
            tax: 0
          },
          {
            description: "Development Levy",
            amount: income,
            rate: "4%",
            tax: Math.round(levy)
          }
        ],
        references: [
          { section: "Section 56", note: "Small companies (turnover ≤ N100,000,000) taxed at 0%" },
          { section: "Section 59", note: "Development levy at 4% on assessable profits" }
        ],
        confidence: "high"
      };
    }
    
    const companyTax = income * companyRate;
    const levy = income * developmentLevy;
    const totalTax = companyTax + levy;
    
    return {
      answer: `Based on the Nigeria Tax Act, as a **company** with turnover of **N${income.toLocaleString()}**, your tax calculation is:\n\n• **Companies Income Tax (30%)**: N${Math.round(companyTax).toLocaleString()}\n• **Development Levy (4%)**: N${Math.round(levy).toLocaleString()}\n• **Total Tax Payable**: **N${Math.round(totalTax).toLocaleString()}**`,
      eligible: true,
      taxAmount: Math.round(totalTax),
      breakdown: [
        {
          description: "Companies Income Tax",
          amount: income,
          rate: "30%",
          tax: Math.round(companyTax)
        },
        {
          description: "Development Levy",
          amount: income,
          rate: "4%",
          tax: Math.round(levy)
        }
      ],
      references: [
        { section: "Section 56", note: "Companies taxed at 30%" },
        { section: "Section 59", note: "Development levy at 4%" }
      ],
      confidence: "high"
    };
  }

  const minimumWage = 360000; 
    
  if (income <= minimumWage) {
    return {
      answer: `Based on the Nigeria Tax Act (Section 58), individuals earning at or below the minimum wage (approximately **N${minimumWage.toLocaleString()}** annually) are **exempt from income tax**.\n\nYour income of **N${income.toLocaleString()}** falls below this threshold, so you are **not required to pay tax**.`,
      eligible: false,
      references: [
        { section: "Section 58", note: "Exemption for minimum wage earners" }
      ],
      confidence: "high"
    };
  }
  
  const brackets = [
    { min: 0, max: 800000, rate: 0, desc: "First N800,000" },
    { min: 800001, max: 3000000, rate: 0.15, desc: "Next N2,200,000" },
    { min: 3000001, max: 12000000, rate: 0.18, desc: "Next N9,000,000" },
    { min: 12000001, max: 25000000, rate: 0.21, desc: "Next N13,000,000" },
    { min: 25000001, max: 50000000, rate: 0.23, desc: "Next N25,000,000" },
    { min: 50000001, max: null, rate: 0.25, desc: "Above N50,000,000" }
  ];
  
  let remainingIncome = income;
  let totalTax = 0;
  let breakdown = [];
  let calculationSteps = [];

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;
    
    const bracketMax = bracket.max === null ? Infinity : bracket.max;
    const taxableInBracket = Math.min(remainingIncome, bracketMax - bracket.min + 1);
    
    if (taxableInBracket > 0) {
      const bracketTax = taxableInBracket * bracket.rate;
      totalTax += bracketTax;
      
      if (bracket.rate > 0) {
        calculationSteps.push(`• ${bracket.desc}: N${taxableInBracket.toLocaleString()} at ${bracket.rate * 100}% = N${Math.round(bracketTax).toLocaleString()}`);
      }
      
      breakdown.push({
        description: bracket.desc,
        amount: Math.round(taxableInBracket),
        rate: `${bracket.rate * 100}%`,
        tax: Math.round(bracketTax)
      });
      
      remainingIncome -= taxableInBracket;
    }
  }
  
  const effectiveRate = (totalTax / income) * 100;
  
  let answer = `Based on the Nigeria Tax Act, as an **individual** earning **N${income.toLocaleString()}** per year, your estimated tax is **N${Math.round(totalTax).toLocaleString()}**.\n\n**Calculation:**\n`;
  answer += calculationSteps.length > 0 ? calculationSteps.join('\n') : "• All income falls within the 0% bracket";
  answer += `\n\n**Effective Tax Rate:** ${effectiveRate.toFixed(1)}%`;

  return {
    answer,
    eligible: true,
    taxableIncome: income,
    taxAmount: Math.round(totalTax),
    effectiveRate: Math.round(effectiveRate * 10) / 10,
    breakdown,
    references: [
      { section: "Fourth Schedule", note: "Progressive tax rates for individuals" }
    ],
    confidence: "high"
  };
};

const calculateTaxWithRules = (info: ExtractedInfo, rules: TaxRules): any => {
  const { income, isCompany } = info;
  
  if (!income) {
    return {
      answer: "Income amount is required for tax calculation.",
      confidence: "low"
    };
  }
  
  if (isCompany === true) {
    const companyRate = rules.companyRate || 0.30;
    const smallCompanyThreshold = rules.smallCompanyThreshold || 100000000;
    const developmentLevy = rules.developmentLevy || 0.04;
    
    if (income <= smallCompanyThreshold) {
      const levy = income * developmentLevy;
      
      return {
        answer: `Based on the Nigeria Tax Act, as a **small company** with turnover of **N${income.toLocaleString()}**, you qualify for the small company tax rate of **0%**.\n\nHowever, you still need to pay development levy of **${(developmentLevy * 100).toFixed(1)}%** which amounts to **N${Math.round(levy).toLocaleString()}**.\n\n**Total Tax Payable: N${Math.round(levy).toLocaleString()}**`,
        eligible: true,
        taxAmount: Math.round(levy),
        breakdown: [
          {
            description: "Companies Income Tax (Small Company Rate)",
            amount: income,
            rate: "0%",
            tax: 0
          },
          {
            description: "Development Levy",
            amount: income,
            rate: `${(developmentLevy * 100).toFixed(1)}%`,
            tax: Math.round(levy)
          }
        ],
        references: [
          { section: "Section 56", note: `Small companies (turnover ≤ N${smallCompanyThreshold.toLocaleString()}) taxed at 0%` },
          { section: "Section 59", note: `Development levy at ${(developmentLevy * 100).toFixed(1)}%` }
        ],
        confidence: "high"
      };
    }
    
    const companyTax = income * companyRate;
    const levy = income * developmentLevy;
    const totalTax = companyTax + levy;
    
    return {
      answer: `Based on the Nigeria Tax Act, as a **company** with turnover of **N${income.toLocaleString()}**, your tax calculation is:\n\n• **Companies Income Tax (${(companyRate * 100).toFixed(1)}%)**: N${Math.round(companyTax).toLocaleString()}\n• **Development Levy (${(developmentLevy * 100).toFixed(1)}%)**: N${Math.round(levy).toLocaleString()}\n• **Total Tax Payable**: **N${Math.round(totalTax).toLocaleString()}**`,
      eligible: true,
      taxAmount: Math.round(totalTax),
      breakdown: [
        {
          description: "Companies Income Tax",
          amount: income,
          rate: `${(companyRate * 100).toFixed(1)}%`,
          tax: Math.round(companyTax)
        },
        {
          description: "Development Levy",
          amount: income,
          rate: `${(developmentLevy * 100).toFixed(1)}%`,
          tax: Math.round(levy)
        }
      ],
      references: [
        { section: "Section 56", note: `Companies taxed at ${(companyRate * 100).toFixed(1)}%` },
        { section: "Section 59", note: `Development levy at ${(developmentLevy * 100).toFixed(1)}%` }
      ],
      confidence: "high"
    };
  }
  

  const minimumWage = rules.minimumWage || 360000;
  
  if (income <= minimumWage) {
    return {
      answer: `Based on the Nigeria Tax Act (Section 58), individuals earning at or below the minimum wage (approximately **N${minimumWage.toLocaleString()}** annually) are **exempt from income tax**.\n\nYour income of **N${income.toLocaleString()}** falls below this threshold, so you are **not required to pay tax**.`,
      eligible: false,
      references: [
        { section: "Section 58", note: "Exemption for minimum wage earners" }
      ],
      confidence: "high"
    };
  }
  
 
  const brackets = rules.brackets && rules.brackets.length > 0 ? rules.brackets : [
    { min: 0, max: 800000, rate: 0, description: "First N800,000 at 0%" },
    { min: 800001, max: 3000000, rate: 0.15, description: "Next N2,200,000 at 15%" },
    { min: 3000001, max: 12000000, rate: 0.18, description: "Next N9,000,000 at 18%" },
    { min: 12000001, max: 25000000, rate: 0.21, description: "Next N13,000,000 at 21%" },
    { min: 25000001, max: 50000000, rate: 0.23, description: "Next N25,000,000 at 23%" },
    { min: 50000001, max: null, rate: 0.25, description: "Above N50,000,000 at 25%" }
  ];
  
  let taxableIncome = income;
  if (rules.personalRelief) {
    taxableIncome = Math.max(0, income - rules.personalRelief);
  }
  
  let remainingIncome = taxableIncome;
  let totalTax = 0;
  let breakdown = [];
  let calculationSteps = [];

  const sortedBrackets = [...brackets].sort((a, b) => a.min - b.min);

  for (const bracket of sortedBrackets) {
    if (remainingIncome <= 0) break;
    
    const bracketMax = bracket.max === null ? Infinity : bracket.max;
    const taxableInBracket = Math.min(remainingIncome, bracketMax - bracket.min + 1);
    
    if (taxableInBracket > 0) {
      const bracketTax = taxableInBracket * bracket.rate;
      totalTax += bracketTax;
      
      if (bracket.rate > 0) {
        calculationSteps.push(`• ${bracket.description}: N${taxableInBracket.toLocaleString()} at ${bracket.rate * 100}% = N${Math.round(bracketTax).toLocaleString()}`);
      }
      
      breakdown.push({
        description: bracket.description,
        amount: Math.round(taxableInBracket),
        rate: `${bracket.rate * 100}%`,
        tax: Math.round(bracketTax)
      });
      
      remainingIncome -= taxableInBracket;
    }
  }
  
  const effectiveRate = (totalTax / income) * 100;
  
  let answer = `Based on the Nigeria Tax Act, as an **individual** earning **N${income.toLocaleString()}** per year, your estimated tax is **N${Math.round(totalTax).toLocaleString()}**.\n\n**Calculation:**\n`;
  answer += calculationSteps.length > 0 ? calculationSteps.join('\n') : "• All income falls within the 0% bracket";
  answer += `\n\n**Effective Tax Rate:** ${effectiveRate.toFixed(1)}%`;

  return {
    answer,
    eligible: true,
    taxableIncome: Math.round(taxableIncome),
    taxAmount: Math.round(totalTax),
    effectiveRate: Math.round(effectiveRate * 10) / 10,
    breakdown,
    references: [
      { section: "Fourth Schedule", note: "Progressive tax rates for individuals" }
    ],
    confidence: "high"
  };
};


const extractTaxRulesFromDocument = async (document: any, isCompany?: boolean): Promise<TaxRules | null> => {
  try {
    const allChunks = document.chunks || [];
    
    if (allChunks.length === 0) {
      console.log('No chunks found in document');
      return null;
    }

    const relevantChunks = allChunks.filter((chunk: any) => {
      const content = (chunk.chapter + ' ' + chunk.content).toLowerCase();
      return content.includes('rate') || 
             content.includes('%') || 
             content.includes('schedule') ||
             content.includes('fourth schedule') ||
             content.includes('section 56') ||
             content.includes('section 59') ||
             content.includes('tax');
    }).slice(0, 8);

    if (relevantChunks.length === 0) {
      console.log('No relevant chunks found');
      return null;
    }

    const context = relevantChunks.map((chunk: any) => 
      `[${chunk.chapter || 'Section'}]: ${chunk.content.substring(0, 500)}`
    ).join('\n\n---\n\n');

    const prompt = `
      Extract tax rates and rules from these Nigeria Tax Act excerpts.

      EXCERPTS:
      ${context}

      Look for:
      1. Individual tax rates (Fourth Schedule)
      2. Company tax rate (Section 56)
      3. Development levy rate (Section 59)
      4. Small company threshold
      5. Minimum wage exemption

      Return JSON:
      {
        "brackets": [
          {"min": 0, "max": 800000, "rate": 0, "description": "First N800,000 at 0%"}
        ],
        "companyRate": 0.30,
        "smallCompanyThreshold": 100000000,
        "developmentLevy": 0.04,
        "minimumWage": 360000
      }

      Use null for missing values. Convert percentages to decimals (15% = 0.15).
      Return ONLY valid JSON.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Extract tax rules as JSON. Use null for missing values. Return valid JSON only." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) return null;

    try {
      const parsed = JSON.parse(aiResponse);
      
      return {
        hasProgressiveRates: true,
        brackets: parsed.brackets || [],
        personalRelief: parsed.personalRelief,
        minimumWage: parsed.minimumWage || 360000,
        companyRate: parsed.companyRate || 0.30,
        smallCompanyThreshold: parsed.smallCompanyThreshold || 100000000,
        developmentLevy: parsed.developmentLevy || 0.04
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Error extracting rules:', error);
    return null;
  }
};

const answerGeneralQuery = async (query: string, document: any): Promise<any> => {
  try {
    const lowerQuery = query.toLowerCase();
    const allChunks = document.chunks || [];
    let searchTerms: string[] = [];
    
    if (lowerQuery.includes('vat') || lowerQuery.includes('value added tax')) {
      searchTerms = ['vat', 'value added tax', 'section 14', 'chapter six', 'taxable supplies'];
    } else if (lowerQuery.includes('deduct') || lowerQuery.includes('expense') || lowerQuery.includes('claim')) {
      searchTerms = ['deduction', 'deduct', 'expense', 'allowable', 'section 20', 'section 21'];
    } else if (lowerQuery.includes('deadline') || lowerQuery.includes('file') || lowerQuery.includes('due')) {
      searchTerms = ['deadline', 'file', 'return', 'due date', 'section 22', 'section 23', 'section 24'];
    } else if (lowerQuery.includes('register') || lowerQuery.includes('registration')) {
      searchTerms = ['register', 'registration', 'file', 'return'];
    } else {
      searchTerms = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    }
    
    const relevantChunks = allChunks
      .filter((chunk: any) => {
        const content = (chunk.chapter + ' ' + chunk.content).toLowerCase();
        return searchTerms.some((term: string) => content.includes(term));
      })
      .slice(0, 5);


    if (relevantChunks.length > 0) {
      const context = relevantChunks.map((chunk: any) => 
        `[${chunk.chapter || 'Section'}]: ${chunk.content.substring(0, 500)}`
      ).join('\n\n');

      const prompt = `
        Answer this question based on the Nigeria Tax Act excerpts provided.

        Question: ${query}

        Relevant Excerpts:
        ${context}

        Instructions:
        1. Answer based ONLY on the excerpts provided
        2. Be concise and helpful
        3. If the answer isn't in the excerpts, say so
        4. Cite specific sections when possible
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You answer questions about the Nigeria Tax Act based on provided excerpts." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.2,
      });

      const answer = response.choices[0]?.message?.content;
      
      if (answer) {
        return {
          answer,
          confidence: "high",
          references: relevantChunks.slice(0, 3).map((c: any) => ({
            section: c.chapter || 'Section',
            excerpt: c.content.substring(0, 150) + '...'
          }))
        };
      }
    }

    return getGeneralKnowledgeFallback(query);

  } catch (error) {
    console.error('Error in general query:', error);
    return getGeneralKnowledgeFallback(query);
  }
};

const getGeneralKnowledgeFallback = (query: string): any => {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('vat') || lowerQuery.includes('value added tax')) {
    if (lowerQuery.includes('rate')) {
      return {
        answer: "Under the Nigeria Tax Act, the **Value Added Tax (VAT) rate is 7.5%** on taxable supplies. This is provided in Section 147 of the Act.\n\nSome supplies are exempt from VAT including:\n• Basic food items\n• Medical and pharmaceutical products\n• Educational books and materials\n• Medical services\n• Exported goods and services",
        confidence: "high",
        references: [
          { section: "Section 147", note: "VAT rate of 7.5%" },
          { section: "Section 185", note: "Exempt supplies" }
        ]
      };
    }
    
    if (lowerQuery.includes('register') || lowerQuery.includes('registration')) {
      return {
        answer: "Under the Nigeria Tax Act, businesses with an annual turnover **above N25 million** are required to register for VAT. Registration must be done within 6 months of commencement or when the threshold is reached.\n\nVAT returns must be filed monthly by the 14th day of the following month.",
        confidence: "high",
        references: [
          { section: "Section 150", note: "Registration requirements" },
          { section: "Section 154", note: "Filing deadlines" }
        ]
      };
    }
    
    return {
      answer: "**Value Added Tax (VAT)** under the Nigeria Tax Act:\n\n• **Rate:** 7.5% (Section 147)\n• **Registration threshold:** Annual turnover above N25 million\n• **Filing deadline:** 14th day of the following month\n• **Exempt supplies:** Basic food items, medical products, educational materials, medical services, exported goods\n\nWould you like more specific information about VAT rates, registration, or exemptions?",
      confidence: "high",
      references: [
        { section: "Chapter Six", note: "Value Added Tax provisions (Sections 143-157)" }
      ]
    };
  }
  
  if (lowerQuery.includes('deduct') || lowerQuery.includes('expense') || lowerQuery.includes('claim')) {
    return {
      answer: "Under **Section 20 of the Nigeria Tax Act**, you can deduct expenses that are **wholly and exclusively** incurred in producing income.\n\n**Allowable deductions include:**\n• Staff salaries, wages, and benefits\n• Rent and rates on business premises\n• Interest on business loans\n• Repairs and maintenance\n• Bad debts actually written off\n• Research and development costs\n• Pension contributions\n• Donations to approved funds (up to 10% of profit)\n\n**Non-deductible expenses (Section 21):**\n• Capital expenditure\n• Private or domestic expenses\n• Taxes on profits\n• Depreciation (capital allowances claimed instead)\n• Penalties and fines",
      confidence: "high",
      references: [
        { section: "Section 20", note: "Deductions allowed" },
        { section: "Section 21", note: "Deductions not allowed" }
      ]
    };
  }
  
  if (lowerQuery.includes('deadline') || lowerQuery.includes('file') || lowerQuery.includes('due')) {
    return {
      answer: "**Tax filing deadlines under the Nigeria Tax Act:**\n\n**Individuals:**\n• Annual tax returns due by **March 31st** each year\n• Self-employed individuals may pay in instalments\n\n**Companies:**\n• Company income tax returns due within **6 months** of year-end\n• Estimated taxes may be paid in instalments\n\n**VAT:**\n• Monthly returns due by the **14th day** of the following month\n\n**Capital Gains Tax:**\n• Due within 3 months of disposal or by 31 March following year of assessment\n\nPenalties apply for late filing under Section 68 of the Nigeria Tax Administration Act.",
      confidence: "high",
      references: [
        { section: "Section 22-24", note: "Basis periods and filing" },
        { section: "Section 154", note: "VAT filing deadlines" }
      ]
    };
  }
  return {
    answer: "Based on the Nigeria Tax Act, I can help you with information about:\n\n• **Tax rates** for individuals and companies\n• **VAT** rates, registration, and filing\n• **Deductions** and allowable expenses\n• **Filing deadlines** and requirements\n• **Tax calculations** for specific incomes\n\nPlease ask a more specific question, or provide your income amount for a tax calculation.",
    confidence: "medium",
    references: []
  };
};



export const getTaxQueryHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any).id;
    const { page = 1, limit = 10 } = req.query;

    const queries = await prisma.searchHistory.findMany({
      where: { userId },
      include: {
        document: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.searchHistory.count({ where: { userId } });

    sendSuccessResponse(res, 'Query history retrieved', {
      queries,
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


const processQuestionWithTaxLogic = (question: string): any => {
  // console.log('🧮 Processing question with tax logic:', question);
  const extractedInfo = extractInfoFromQuery(question);
  const isCalculationQuery = 
    question.toLowerCase().includes('how much') || 
    question.toLowerCase().includes('calculate') || 
    question.toLowerCase().includes('tax on') || 
    question.toLowerCase().includes('pay on') ||
    (extractedInfo.income !== undefined && extractedInfo.income > 0);
  
  // If it's a calculation with income, use the tax calculator
  if (extractedInfo.income && (extractedInfo.queryType === 'calculation' || isCalculationQuery)) {
    const result = calculateTaxWithStandardRates(extractedInfo);
    return {
      question,
      answer: result.answer,
      confidence: result.confidence,
      taxCalculation: {
        amount: result.taxAmount,
        breakdown: result.breakdown,
        eligible: result.eligible,
        effectiveRate: result.effectiveRate
      },
      type: 'calculation'
    };
  }
  
  if (extractedInfo.queryType === 'deadline' || 
      extractedInfo.queryType === 'vat' || 
      extractedInfo.queryType === 'deduction' ||
      extractedInfo.queryType === 'rate') {
    const result = getGeneralKnowledgeFallback(question);
    return {
      question,
      answer: result.answer,
      confidence: result.confidence,
      references: result.references,
      type: 'general'
    };
  }
  
  return {
    question,
    answer: "I can't help you with this question. Please use the regular tax query endpoint for more detailed calculations.",
    confidence: "medium",
    type: 'general'
  };
};


const findQuestionsWithExtraction = (content: string): DocumentQuestion[] => {
  const questions: DocumentQuestion[] = [];
  const lines = content.split(/[.!?\n]+/);
  

  const questionStarters = [
    'what', 'when', 'where', 'who', 'why', 'how', 
    'is', 'are', 'can', 'does', 'do', 'will', 'would',
    'should', 'could', 'may', 'please explain', 'tell me',
    'calculate', 'compute', 'determine'
  ];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.length < 5) return;
    
    const lowerLine = trimmed.toLowerCase();
    
    if (trimmed.includes('?')) {
      const extractedInfo = extractInfoFromQuery(trimmed);
      questions.push({
        text: trimmed,
        type: extractedInfo.income ? 'calculation' : 'explicit',
        confidence: 'high',
        extractedInfo
      });
    }
    else if (questionStarters.some(starter => lowerLine.startsWith(starter))) {
      const extractedInfo = extractInfoFromQuery(trimmed);
      questions.push({
        text: trimmed + '?',
        type: extractedInfo.income ? 'calculation' : 'implied',
        confidence: 'medium',
        extractedInfo
      });
    }
    else if (/\d+/.test(trimmed) && 
      (lowerLine.includes('tax') || lowerLine.includes('pay') || 
      lowerLine.includes('due') || lowerLine.includes('owe'))) {
      const extractedInfo = extractInfoFromQuery(trimmed);
      questions.push({
        text: trimmed + '?',
        type: 'calculation',
        confidence: 'medium',
        extractedInfo
      });
    }
  });
  
  return questions;
};

const analyzeDocumentWithTaxLogic = async (documentContent: string): Promise<any> => {
  // console.log('🔍 Starting document analysis with tax logic...');
  const questions = findQuestionsWithExtraction(documentContent);
  // console.log(`📋 Found ${questions.length} questions`);
  const answeredQuestions = questions.map(q => {
    // console.log(`🔄 Processing: ${q.text}`);
    return processQuestionWithTaxLogic(q.text);
  });
 
  const lowerContent = documentContent.toLowerCase();
  const wordCount = documentContent.split(/\s+/).length;
  
  const hasVAT = lowerContent.includes('vat') || lowerContent.includes('value added tax');
  const hasCorporate = lowerContent.includes('company') || lowerContent.includes('corporate');
  const hasDeadlines = lowerContent.includes('deadline') || lowerContent.includes('due') || lowerContent.includes('file');

  let summary = '';
  if (answeredQuestions.length > 0) {
    summary = `Found ${answeredQuestions.length} question${answeredQuestions.length > 1 ? 's' : ''} in the document. `;
    const calculationCount = answeredQuestions.filter(q => q.type === 'calculation').length;
    if (calculationCount > 0) {
      summary += `${calculationCount} calculation${calculationCount > 1 ? 's' : ''} performed. `;
    }
  } else {
    summary = 'No specific questions found in the document. ';
  }
  
  if (hasVAT) summary += 'VAT information detected. ';
  if (hasCorporate) summary += 'Corporate tax information detected. ';
  if (hasDeadlines) summary += 'Deadline information detected. ';
  
  return {
    hasTaxInformation: answeredQuestions.length > 0 || hasVAT || hasCorporate,
    documentType: determineDocumentTypeLocal(lowerContent),
    summary: summary.trim() || 'Document contains tax-related content.',
    taxRates: extractTaxRatesLocal(documentContent),
    deadlines: extractDeadlinesLocal(documentContent),
    answeredQuestions,
    keyFindings: [
      ...(answeredQuestions.length > 0 ? [`${answeredQuestions.length} questions processed`] : []),
      ...(hasVAT ? ['VAT information present'] : []),
      ...(hasCorporate ? ['Corporate tax information present'] : []),
      ...(hasDeadlines ? ['Deadline information present'] : [])
    ].slice(0, 5),
    confidence: "high",
    analysisMethod: 'tax_logic_integrated',
    wordCount
  };
};



const extractTaxRatesLocal = (content: string): any[] => {
  const rates: any[] = [];
  const lowerContent = content.toLowerCase();
  
  const patterns = [
    { type: 'VAT', keywords: ['vat', 'value added tax'], regex: /(\d+(?:\.\d+)?)\s*%/i },
    { type: 'Corporate', keywords: ['company', 'corporate', 'cita', 'companies'], regex: /(\d+(?:\.\d+)?)\s*%/i },
    { type: 'Personal', keywords: ['personal', 'individual', 'paye', 'income tax'], regex: /(\d+(?:\.\d+)?)\s*%/i },
    { type: 'Capital Gains', keywords: ['capital gains', 'cgt'], regex: /(\d+(?:\.\d+)?)\s*%/i },
    { type: 'Withholding', keywords: ['withholding', 'wht'], regex: /(\d+(?:\.\d+)?)\s*%/i },
    { type: 'Education Tax', keywords: ['education', 'tet', 'tertiary'], regex: /(\d+(?:\.\d+)?)\s*%/i },
    { type: 'Development Levy', keywords: ['development levy', 'levy'], regex: /(\d+(?:\.\d+)?)\s*%/i }
  ];
  
  patterns.forEach(pattern => {
    const isMentioned = pattern.keywords.some(keyword => lowerContent.includes(keyword));
    
    if (isMentioned) {
      const match = content.match(pattern.regex);
      if (match) {
        rates.push({
          type: pattern.type,
          rate: match[1] + '%',
          details: `As specified in the document`
        });
      }
    }
  });
  
  return rates;
};

const extractDeadlinesLocal = (content: string): any[] => {
  const deadlines: any[] = [];
  const lowerContent = content.toLowerCase();
  
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
    'july', 'august', 'september', 'october', 'november', 'december'];
  
  const lines = content.split(/[.!?\n]+/);
  
  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('deadline') || lowerLine.includes('due') || 
      lowerLine.includes('file by') || lowerLine.includes('submit by')) {
      
      const mentionedMonth = months.find(m => lowerLine.includes(m));
      if (mentionedMonth) {
        deadlines.push({
          type: 'filing',
          description: line.trim(),
          deadline: mentionedMonth,
          penalty: extractPenalty(line)
        });
      }
      
      if (lowerLine.includes('march 31') || lowerLine.includes('31st march')) {
        deadlines.push({
          type: 'filing',
          description: line.trim(),
          deadline: 'March 31st',
          penalty: extractPenalty(line)
        });
      }
      
      if (lowerLine.includes('14th') && lowerLine.includes('month')) {
        deadlines.push({
          type: 'vat',
          description: 'VAT return filing',
          deadline: '14th day of following month',
          penalty: extractPenalty(line)
        });
      }
    }
  });
  
  return deadlines;
};

const extractDeductionsLocal = (content: string): any[] => {
  const deductions: any[] = [];
  const lowerContent = content.toLowerCase();
  
  const deductionKeywords = [
    'deduct', 'deduction', 'allowable', 'expense', 'cost', 
    'capital allowance', 'relief', 'pension', 'donation', 
    'interest', 'rent', 'salary', 'wear and tear'
  ];
  
  const lines = content.split(/[.!?\n]+/);
  const seen = new Set();
  
  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    deductionKeywords.forEach(keyword => {
      if (lowerLine.includes(keyword) && 
          (lowerLine.includes('deduct') || lowerLine.includes('allow'))) {
        
        const key = keyword + line.substring(0, 30);
        if (!seen.has(key)) {
          seen.add(key);
          deductions.push({
            type: keyword,
            description: line.trim(),
            conditions: extractConditions(line)
          });
        }
      }
    });
  });
  
  return deductions;
};

const extractExemptionsLocal = (content: string): any[] => {
  const exemptions: any[] = [];
  const lowerContent = content.toLowerCase();
  
  const exemptionKeywords = [
    'exempt', 'exemption', 'not taxable', 'tax free', 'zero-rated',
    'threshold', 'below', 'minimum wage', 'small company'
  ];
  
  const lines = content.split(/[.!?\n]+/);
  const seen = new Set();
  
  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    exemptionKeywords.forEach(keyword => {
      if (lowerLine.includes(keyword)) {
        const key = keyword + line.substring(0, 30);
        if (!seen.has(key)) {
          seen.add(key);
          exemptions.push({
            type: 'Exemption',
            description: line.trim(),
            conditions: extractConditions(line)
          });
        }
      }
    });
  });
  
  return exemptions;
};

const extractThresholdsLocal = (content: string): any[] => {
  const thresholds: any[] = [];
  
  const amountPattern = /[N₦]\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(million|billion|thousand|m|bn|k|mille)?/gi;
  const matches = [...content.matchAll(amountPattern)];
  
  const seen = new Set();
  
  matches.forEach(match => {
    const fullMatch = match[0];
    const amount = match[1];
  
    const index = match.index || 0;
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + 50);
    const context = content.substring(start, end).trim();
    
    if (!seen.has(fullMatch)) {
      seen.add(fullMatch);
      
      let type = 'Monetary Threshold';
      if (context.toLowerCase().includes('vat')) type = 'VAT Registration';
      if (context.toLowerCase().includes('company')) type = 'Company Tax';
      if (context.toLowerCase().includes('individual')) type = 'Personal Income';
      
      thresholds.push({
        type: type,
        amount: fullMatch,
        description: context
      });
    }
  });
  
  return thresholds;
};

const findQuestionsLocal = (content: string): any[] => {
  const questions: any[] = [];
  const lines = content.split(/[.!?\n]+/);
  
  const questionStarters = [
    'what', 'when', 'where', 'who', 'why', 'how', 
    'is', 'are', 'can', 'does', 'do', 'will', 'would',
    'should', 'could', 'may', 'please explain', 'tell me',
    'calculate', 'compute', 'determine'
  ];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.length < 5) return;
    
    const lowerLine = trimmed.toLowerCase();
    
    if (trimmed.includes('?')) {
      questions.push({
        text: trimmed,
        type: 'explicit',
        confidence: 'high'
      });
    }

    else if (questionStarters.some(starter => lowerLine.startsWith(starter))) {
      questions.push({
        text: trimmed + '?',
        type: 'implied',
        confidence: 'medium'
      });
    }

    else if (/\d+/.test(trimmed) && 
      (lowerLine.includes('tax') || lowerLine.includes('pay') || 
      lowerLine.includes('due') || lowerLine.includes('owe'))) {
      questions.push({
        text: trimmed + '?',
        type: 'calculation',
        confidence: 'medium'
      });
    }
  });
  
  return questions;
};

const extractPenalty = (line: string): string => {
  if (line.toLowerCase().includes('penalty')) {
    const penaltyPart = line.substring(line.toLowerCase().indexOf('penalty'));
    return penaltyPart.trim();
  }
  return 'As specified in document';
};

const extractConditions = (line: string): string => {
  if (line.toLowerCase().includes('if') || line.toLowerCase().includes('provided') || 
      line.toLowerCase().includes('subject to') || line.toLowerCase().includes('except')) {
    return line.trim();
  }
  return 'As per document provisions';
};

const determineDocumentTypeLocal = (content: string): string => {
  const lower = content.toLowerCase();
  
  if (lower.includes('vat') || lower.includes('value added tax')) {
    return 'vat_guide';
  }
  if (lower.includes('company') || lower.includes('corporate') || lower.includes('cita')) {
    return 'company_tax';
  }
  if (lower.includes('individual') || lower.includes('personal') || lower.includes('paye')) {
    return 'individual_tax';
  }
  if (lower.includes('act') || lower.includes('section') || lower.includes('chapter')) {
    return 'tax_act';
  }
  return 'general_tax_document';
};

const generateAnswerForQuestion = (question: any, extracted: any): string => {
  const qText = question.text.toLowerCase();
  
  // VAT questions
  if (qText.includes('vat') || qText.includes('value added tax')) {
    const vatRate = extracted.taxRates?.find((r: any) => r.type === 'VAT');
    if (vatRate) {
      return `Based on the document, VAT is ${vatRate.rate}. ${vatRate.details || ''}`;
    }
    return "The document contains VAT information. Please review the VAT section for specific rates.";
  }
  
  if (qText.includes('deadline') || qText.includes('due') || qText.includes('file') || qText.includes('submit')) {
    if (extracted.deadlines && extracted.deadlines.length > 0) {
      return extracted.deadlines.map((d: any) => 
        `${d.description}: ${d.deadline}`
      ).join('. ');
    }
    return "The document discusses filing deadlines. Please check the deadlines section.";
  }
  
  if (qText.includes('rate') || qText.includes('percentage') || qText.includes('%')) {
    if (extracted.taxRates && extracted.taxRates.length > 0) {
      return extracted.taxRates.map((r: any) => 
        `${r.type}: ${r.rate}`
      ).join('. ');
    }
    return "Tax rates are mentioned in the document. Please review the rates section.";
  }
  
  if (qText.includes('deduct') || qText.includes('expense') || qText.includes('claim')) {
    if (extracted.deductions && extracted.deductions.length > 0) {
      return `The document mentions ${extracted.deductions.length} types of deductions. Please review the deductions section for details.`;
    }
    return "Deductions are discussed in the document. Please check the allowable expenses section.";
  }
  
  if (qText.includes('threshold') || qText.includes('limit') || qText.includes('minimum')) {
    if (extracted.thresholds && extracted.thresholds.length > 0) {
      return extracted.thresholds.map((t: any) => 
        `${t.type}: ${t.amount}`
      ).join('. ');
    }
    return "Monetary thresholds are mentioned in the document. Please check the relevant sections.";
  }
  return "This information can be found in the document. Please review the relevant section.";
};

const generateKeyFindingsLocal = (
  taxRates: any[],
  deadlines: any[],
  deductions: any[],
  exemptions: any[],
  thresholds: any[]
): string[] => {
  const findings = [];
  
  if (taxRates.length > 0) {
    findings.push(`Document specifies ${taxRates.length} tax rate${taxRates.length > 1 ? 's' : ''}`);
  }
  
  if (deadlines.length > 0) {
    findings.push(`Contains ${deadlines.length} deadline${deadlines.length > 1 ? 's' : ''} for filings`);
  }
  
  if (deductions.length > 0) {
    findings.push(`Discusses ${deductions.length} deduction type${deductions.length > 1 ? 's' : ''}`);
  }
  
  if (exemptions.length > 0) {
    findings.push(`Mentions ${exemptions.length} exemption${exemptions.length > 1 ? 's' : ''}`);
  }
  
  if (thresholds.length > 0) {
    findings.push(`Includes ${thresholds.length} monetary threshold${thresholds.length > 1 ? 's' : ''}`);
  }
  
  if (findings.length === 0) {
    findings.push('Document contains general tax information');
  }
  
  return findings;
};

const generateLocalSummary = (
  taxRates: any[],
  deadlines: any[],
  deductions: any[],
  exemptions: any[],
  thresholds: any[],
  questions: any[],
  wordCount: number
): string => {
  let summary = [];
  
  if (taxRates.length > 0) {
    summary.push(`Tax rates: ${taxRates.map(r => `${r.type} (${r.rate})`).join(', ')}.`);
  } else {
    summary.push('No specific tax rates found.');
  }
  
  if (deadlines.length > 0) {
    summary.push(`Deadlines: ${deadlines.map(d => d.deadline).join(', ')}.`);
  }
  
  if (deductions.length > 0) {
    summary.push(`Deductions: ${deductions.length} types mentioned.`);
  }
  
  if (exemptions.length > 0) {
    summary.push(`Exemptions: ${exemptions.length} types mentioned.`);
  }
  
  if (thresholds.length > 0) {
    summary.push(`Monetary thresholds: ${thresholds.length} found.`);
  }
  
  if (questions.length > 0) {
    summary.push(`Questions: ${questions.length} ${questions[0]?.type === 'explicit' ? 'explicit questions' : 'queries'} identified.`);
  }
  
  summary.push(`Document length: ${wordCount} words.`);
  
  return summary.join(' ');
};

const getEmptyDocumentResponse = (): any => ({
  hasTaxInformation: false,
  documentType: 'empty',
  summary: 'The uploaded document appears to be empty or contains no readable content. Please upload a document with tax information.',
  taxRates: [],
  deadlines: [],
  deductions: [],
  exemptions: [],
  thresholds: [],
  questionsAndAnswers: [],
  keyFindings: ['Document is empty - no content to analyze'],
  confidence: 'high',
  analysisMethod: 'local'
});

const getFallbackResponse = (): any => ({
  hasTaxInformation: true,
  documentType: 'general',
  summary: 'Document processed successfully. You can ask specific questions about tax rates, deadlines, or calculations using the document ID.',
  taxRates: [],
  deadlines: [],
  deductions: [],
  exemptions: [],
  thresholds: [],
  questionsAndAnswers: [],
  keyFindings: ['Document has been saved and is ready for querying'],
  confidence: 'medium',
  analysisMethod: 'fallback'
});

const mergeChunkResults = (results: any[]): any => {
  const merged: any = {
    hasTaxInformation: false,
    documentType: 'large_document',
    summary: '',
    taxRates: [],
    deadlines: [],
    deductions: [],
    exemptions: [],
    thresholds: [],
    questionsAndAnswers: [],
    keyFindings: [],
    confidence: 'high',
    analysisMethod: 'chunked'
  };
  
  results.forEach(result => {
    if (result.hasTaxInformation) merged.hasTaxInformation = true;
    merged.taxRates.push(...(result.taxRates || []));
    merged.deadlines.push(...(result.deadlines || []));
    merged.deductions.push(...(result.deductions || []));
    merged.exemptions.push(...(result.exemptions || []));
    merged.thresholds.push(...(result.thresholds || []));
    merged.questionsAndAnswers.push(...(result.questionsAndAnswers || []));
    merged.keyFindings.push(...(result.keyFindings || []));
  });

  merged.taxRates = merged.taxRates.filter((v: any, i: number, a: any[]) => 
    a.findIndex((t: any) => t.type === v.type) === i
  );
  
  merged.deadlines = merged.deadlines.filter((v: any, i: number, a: any[]) => 
    a.findIndex((d: any) => d.deadline === v.deadline) === i
  );
  
  merged.keyFindings = [...new Set(merged.keyFindings)].slice(0, 5);
  merged.summary = `Document analyzed in ${results.length} parts. Combined findings included above.`;
  
  return merged;
};

const analyzeLocally = (content: string, isChunk: boolean = false): any => {
  console.log('📊 Performing local analysis...');
  
  const lowerContent = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;
  
  const taxRates = extractTaxRatesLocal(content);
  const deadlines = extractDeadlinesLocal(content);
  const deductions = extractDeductionsLocal(content);
  const exemptions = extractExemptionsLocal(content);
  const thresholds = extractThresholdsLocal(content);
  const questions = findQuestionsLocal(content);
  const summary = generateLocalSummary(
    taxRates, deadlines, deductions, exemptions, thresholds, questions, wordCount
  );
  const documentType = determineDocumentTypeLocal(lowerContent);
  
  const keyFindings = generateKeyFindingsLocal(
    taxRates, deadlines, deductions, exemptions, thresholds
  );
  const questionsAndAnswers = questions.map(q => ({
    question: q.text,
    answer: generateAnswerForQuestion(q, {
      taxRates, deadlines, deductions, exemptions, thresholds
    }),
    confidence: q.confidence
  }));
  
  return {
    hasTaxInformation: taxRates.length > 0 || deadlines.length > 0 || 
      deductions.length > 0 || exemptions.length > 0,
    documentType,
    summary,
    taxRates,
    deadlines,
    deductions,
    exemptions,
    thresholds,
    questionsAndAnswers,
    keyFindings: keyFindings.slice(0, 5),
    confidence: "high",
    analysisMethod: 'local',
    wordCount,
    processedLength: content.length
  };
};

const analyzeWithAI = async (content: string, isChunk: boolean = false): Promise<any> => {
  const context = content.substring(0, 20000); // Limit for AI
  
  const prompt = `
    You are a Nigerian tax expert. Analyze this document and extract ALL tax-related information.

    DOCUMENT CONTENT:
    ${context}

    EXTRACTION TASKS:
    1. Find ANY tax-related information including:
       - Tax rates (VAT, corporate, personal, capital gains, etc.)
       - Filing deadlines and due dates
       - Deductions and allowable expenses
       - Exemptions and thresholds
       - Registration requirements
       - Penalties for non-compliance
       - Calculation methods
       - Specific sections or references
    
    2. If you find questions in the document, answer them based on the content
    
    3. If no explicit questions, provide a comprehensive summary of ALL tax information

    Return a JSON response with this structure:
    {
      "hasTaxInformation": true/false,
      "documentType": "tax_act|vat_guide|company_tax|individual_tax|general",
      "summary": "Comprehensive summary of ALL tax information found",
      "taxRates": [
        {
          "type": "VAT|Corporate|Personal|Capital Gains|etc",
          "rate": "the rate as stated",
          "details": "additional details"
        }
      ],
      "deadlines": [
        {
          "type": "filing|payment|registration",
          "description": "what needs to be done",
          "deadline": "when it's due",
          "penalty": "penalty if applicable"
        }
      ],
      "deductions": [
        {
          "type": "expense type",
          "description": "what can be deducted",
          "conditions": "any conditions"
        }
      ],
      "exemptions": [
        {
          "type": "exemption type",
          "description": "what is exempted",
          "conditions": "any conditions"
        }
      ],
      "thresholds": [
        {
          "type": "threshold type",
          "amount": "the amount",
          "description": "what this threshold means"
        }
      ],
      "questionsAndAnswers": [
        {
          "question": "question found in document (if any)",
          "answer": "answer based on document"
        }
      ],
      "keyFindings": ["key point 1", "key point 2", "key point 3"]
    }

    Return ONLY valid JSON. If no tax information found, return {"hasTaxInformation": false, "summary": "No tax information found"}.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-16k",
    messages: [
      {
        role: "system",
        content: "You extract tax information from documents. Always return valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 4000,
    temperature: 0.1,
  });

  const aiResponse = response.choices[0]?.message?.content;
  
  if (!aiResponse) {
    throw new Error('No AI response');
  }
  const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    ...parsed,
    hasContent: true,
    analysisMethod: 'ai'
  };
};


const analyzeLargeDocument = async (documentContent: string): Promise<any> => {
  console.log('📚 Processing large document in chunks...');
  
  const chunkSize = 15000;
  const chunks = [];
  for (let i = 0; i < documentContent.length; i += chunkSize) {
    chunks.push(documentContent.substring(i, i + chunkSize));
  }
  
  console.log(`📑 Split into ${chunks.length} chunks`);
  
  const chunkResults = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`🔍 Analyzing chunk ${i + 1}/${chunks.length}...`);
    
    let chunkResult;
    if (i < 3) { 
      try {
        chunkResult = await analyzeWithAI(chunks[i], true);
      } catch (error) {
        chunkResult = analyzeLocally(chunks[i], true);
      }
    } else {
      chunkResult = analyzeLocally(chunks[i], true);
    }
    
    if (chunkResult) {
      chunkResults.push(chunkResult);
    }
  }
  
  return mergeChunkResults(chunkResults);
};

const analyzeDocumentContent = async (documentContent: string): Promise<any> => {
  try {
    console.log('🔍 Starting comprehensive document analysis...');
    console.log('📄 Document length:', documentContent.length, 'chars');
    
    if (!documentContent || documentContent.trim().length < 50) {
      return getEmptyDocumentResponse();
    }
    if (documentContent.length > 30000) {
      console.log('📚 Large document detected, using chunking...');
      return await analyzeLargeDocument(documentContent);
    }
    
    try {
      console.log('🤖 Attempting AI analysis...');
      const aiResult = await analyzeWithAI(documentContent);
      if (aiResult && aiResult.hasTaxInformation !== undefined) {
        console.log('✅ AI analysis successful');
        return aiResult;
      }
    } catch (aiError) {
      console.log('⚠️ AI analysis failed, using local analysis:', aiError instanceof Error ? aiError.message : 'Unknown error');
    }
    console.log('🔄 Using local analysis fallback');
    return analyzeLocally(documentContent);
    
  } catch (error) {
    console.error('❌ Document analysis error:', error);
    return getFallbackResponse();
  }
};

export const uploadAndQueryTaxDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('📄 Processing uploaded tax document...');

    if (!req.file) {
      return next(new BadRequestError('No file uploaded'));
    }
    const userId = (req.user as any).id;
    let extractedData;
    try {
      extractedData = await extractTextFromFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      console.log('Document text extracted');
      console.log('Extracted text length:', extractedData.text.length);
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      return next(new BadRequestError(`Failed to process file: ${errorMessage}`));
    }

    if (!extractedData.text || extractedData.text.trim().length < 30) {
      return next(new BadRequestError(
        'The uploaded document appears to be empty or contains insufficient content.'
      ));
    }
    const processedContent = TextProcessor.processRawText(
      extractedData.text,
      req.file.originalname
    );

    console.log('📝 Processed content length:', processedContent.rawText.length);
    const document = await prisma.document.create({
      data: {
        title: req.file.originalname.replace(/\.[^/.]+$/, ""),
        filename: req.file.originalname,
        fileUrl: `memory://${req.file.filename}`,
        fileSize: req.file.size,
        uploadedById: userId,
        content: processedContent.rawText,
        processed: true,
        isPublic: false,
      },
    });

    // console.log('💾 Document saved with ID:', document.id);
    // console.log('🔍 Analyzing document with tax logic...');
    const result = await analyzeDocumentWithTaxLogic(processedContent.rawText);

    console.log('✅ Analysis complete. Found:', result.answeredQuestions?.length || 0, 'questions');
    const searchHistory = await prisma.searchHistory.create({
      data: {
        query: `[Document Upload] ${document.title}`,
        results: {
          filename: req.file.originalname,
          timestamp: new Date().toISOString(),
          source: 'tax_document_upload',
          analysis: result
        },
        documentId: document.id,
        userId,
      },
    });
    sendSuccessResponse(res, 'Document analyzed successfully', {
      answers: {
        summary: result.summary,
        questionsAndAnswers: result.answeredQuestions || [],
        taxRates: result.taxRates || [],
        deadlines: result.deadlines || [],
        keyFindings: result.keyFindings || []
      },
      queryId: searchHistory.id,
      document: {
        id: document.id,
        title: document.title,
        filename: document.filename,
        fileSize: document.fileSize,
        pageCount: extractedData.pageCount || null,
        wordCount: result.wordCount
      }
    });

  } catch (error) {
    console.error('❌ Document processing error:', error);
    next(error);
  }
};

export const getTaxQueryResult = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { queryId } = req.params;
    const userId = (req.user as any).id;

    const query = await prisma.searchHistory.findFirst({
      where: { id: queryId, userId },
      include: {
        document: {
          select: { id: true, title: true }
        }
      }
    });

    if (!query) {
      throw new NotFoundError('Query not found');
    }

    sendSuccessResponse(res, 'Query result retrieved', { query });
  } catch (error) {
    next(error);
  }
};