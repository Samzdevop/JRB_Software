import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { BadRequestError } from '../errors/BadRequestError';
import { upload, getFileUrl, deleteFile } from '../config/multer';
import { OpenAI } from 'openai';
import {
  createChunksFromText,
  generateEmbeddingsForChunks,
  isCommonWord,
  shouldRejectAnswer,
  cosineSimilarity
} from '../utils/documentHelpers';
import { extractTextFromFile } from '../utils/fileExtractors';
import { documentSelect } from '../prisma/selects';
import { ProcessedContent, StructuredSection, TextProcessor } from '../utils/textProcessor';

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const uploadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('File:', req.file);
    console.log('Body:', req.body);

    if (!req.file) {
      return next(new BadRequestError('No file uploaded'));
    }

    const { title } = req.body;
    const userId = (req.user as any).id;

    // Extract text from file (PDF or Word)
    let extractedData;
    try {
      extractedData = await extractTextFromFile(
        req.file.buffer,
        req.file.originalname, 
        req.file.mimetype
      );
       console.log('Text extraction successful, length:', extractedData.text.length);
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      console.error('Text extraction failed:', errorMessage);
      return next(new BadRequestError(`Failed to process file: ${errorMessage}`));
    }

    //Process and structure the text 
    const processedContent = TextProcessor.processRawText(
      extractedData.text,
      req.file.originalname
    );

    const document = await prisma.document.create({
      data: {
        title,
        filename: req.file.originalname,
        fileUrl: getFileUrl(req.file.filename),
        fileSize: req.file.size,
        uploadedById: userId,
        // content: extractedData.text,
        content: processedContent.rawText,
        processed: false,
        processingStatus: 'PROCESSING'
      },
    });

    console.log('Document created with ID:', document.id, 'Starting AI processing...');

   processDocumentWithEnhancedAI(extractedData, document.id, req.file.mimetype)
      .then(() => console.log('AI processing completed for document:', document.id))
      .catch((error:any) => {
        console.error('AI processing failed for document:', document.id, error);
        // You might want to update the document status to indicate failure
        prisma.document.update({
          where: { id: document.id },
          data: { processingStatus: 'FAILED' },
        }).catch((error:any) => console.error('Failed to update document status:', error));
      });

    sendSuccessResponse(
      res,
      'Document uploaded successfully. Processing with AI...',
      { 
        document:{
          ...document,
          metadata: processedContent.metadata,
          summary: processedContent.summary
        } 
      },
      201
    );
  } catch (error) {
     console.error('Upload error:', error);
    next(error);
  }
};

// const processDocumentWithAI = async (
//   extractedData: any,
//   documentId: string, 
//   mimeType: string
// ) => {
//   try {
//     console.log(`Starting AI processing for document ${documentId}`);
//     console.log('Text length:', extractedData.text.length);
//     // Use OpenAI to identify chapters and structure
//     const structuredContent = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: `You are a document analysis assistant. Analyze the following document text and identify chapters, sections, and their content. Return a structured JSON format with chapters and their content. Document type: ${mimeType}`
//         },
//         {
//           role: "user",
//           content: `Please analyze this document and extract chapters with their content. Here's the text:\n\n${extractedData.text.substring(0, 12000)}` // Limit to avoid token limits
//         }
//       ],
//       max_tokens: 4000,
//       temperature: 0.1,
//     });

//      console.log('OpenAI response received');
//     const aiResponse = structuredContent.choices[0]?.message?.content;
    
//     if (!aiResponse) {
//       throw new Error('AI processing failed');
//     }

//     console.log('AI response length:', aiResponse.length);

//     // Parse AI response and create chunks
//     let chunks;
//     try {
//        console.log('Attempting to parse AI response as JSON');
//       // Try to parse as JSON first
//       const parsedData = JSON.parse(aiResponse);
//       console.log('JSON parsing successful');
//       chunks = await createChunksFromAI(parsedData, documentId, extractedData.text);
//       console.log(`Document ${documentId} processed successfully with ${chunks.count} chunks`);
//     } catch (parseError) {
//         console.error('Error processing document with AI:', parseError);
//       // If JSON parsing fails, fall back to regex-based chunking
//       chunks = await createChunksFromText(extractedData.text, documentId);
//     }

//     console.log(`Created ${chunks.count} chunks, generating embeddings...`);

//     // Generate embeddings for each chunk
//     await generateEmbeddingsForChunks(documentId, openai);

//     // Mark document as processed
//     await prisma.document.update({
//       where: { id: documentId },
//       data: { processed: true },
//     });

//     console.log(`Document ${documentId} processed successfully with ${chunks.count} chunks`);
//   } catch (error) {
//     console.error('Error processing document with AI:', error);
//     // Fall back to basic processing if AI fails
//     try {
//       console.log('Falling back to basic text chunking');
//       await createChunksFromText(extractedData.text, documentId);
      
//       // Mark as processed even with basic chunks
//       await prisma.document.update({
//         where: { id: documentId },
//         data: { processed: true },
//       });
      
//       console.log('Basic processing completed successfully');
//     } catch (fallbackError) {
//       console.error('Even basic processing failed:', fallbackError);
//       // At this point, the document will remain unprocessed
//     }
//   }
// };

// const createChunksFromAI = async (aiData: any, documentId: string, fullText: string) => {
//   const chunks = [];
  
//   // Handle different possible AI response formats
//   if (aiData.chapters && Array.isArray(aiData.chapters)) {
//     for (const chapter of aiData.chapters) {
//       if (chapter.title && chapter.content) {
//         // Extract page number from content if possible
//         const pageMatch = chapter.content.match(/\[PAGE (\d+)\]/);
//         const pageNumber = pageMatch ? parseInt(pageMatch[1]) : 1;
        
//         chunks.push({
//           documentId,
//           chapter: chapter.title,
//           content: chapter.content.replace(/\[PAGE \d+\]/g, '').trim(),
//           pageNumber,
//         });
//       }
//     }
//   } else if (typeof aiData === 'object') {
//     // Handle other possible structures
//     for (const [key, value] of Object.entries(aiData)) {
//       if (typeof value === 'string') {
//         const pageMatch = value.match(/\[PAGE (\d+)\]/);
//         const pageNumber = pageMatch ? parseInt(pageMatch[1]) : 1;
        
//         chunks.push({
//           documentId,
//           chapter: key,
//           content: value.replace(/\[PAGE \d+\]/g, '').trim(),
//           pageNumber,
//         });
//       }
//     }
//   }

//   if (chunks.length === 0) {
//     // Fallback if AI response format is unexpected
//     return createChunksFromText(fullText, documentId);
//   }

//   return prisma.chunk.createMany({
//     data: chunks,
//   });
// };

// Enhanced version that combines both approaches
const processDocumentWithEnhancedAI = async (
  extractedData: any,
  documentId: string, 
  mimeType: string
) => {
  try {
    console.log(`Starting enhanced AI processing for document ${documentId}`);
    console.log('Text length:', extractedData.text.length);

    // STEP 1: First, use our local text processor to clean and structure
    const processedContent = TextProcessor.processRawText(
      extractedData.text,
      'document' // or use the actual filename
    );

    console.log('Local text processing completed:', {
      sections: processedContent.structuredContent.length,
      wordCount: processedContent.metadata.wordCount
    });

    let chunks;
    
    // STEP 2: Try AI processing for complex documents, otherwise use local processing
    const shouldUseAI = shouldUseAIProcessing(processedContent);
    
    if (shouldUseAI && process.env.USE_AI_PROCESSING !== 'false') {
      console.log('Using AI for document analysis...');
      chunks = await processWithAI(extractedData.text, documentId, mimeType);
    } else {
      console.log('Using local text processing for chunk creation...');
      chunks = await createChunksFromStructuredContent(
        processedContent.structuredContent, 
        documentId
      );
    }

    console.log(`Created ${chunks.count} chunks, generating embeddings...`);

    // STEP 3: Generate embeddings for each chunk
    await generateEmbeddingsForChunks(documentId, openai);

    // STEP 4: Mark document as processed
    await prisma.document.update({
      where: { id: documentId },
      data: { 
        processed: true,
        processingStatus: 'COMPLETED',
        // Store the cleaned content for better display
        content: processedContent.rawText
      },
    });

    console.log(`Document ${documentId} processed successfully with ${chunks.count} chunks`);

  } catch (error) {
    console.error('Error in enhanced AI processing:', error);
    
    // Fallback to basic processing
    try {
      console.log('Falling back to basic text chunking');
      const basicChunks = await createChunksFromText(extractedData.text, documentId);
      
      await prisma.document.update({
        where: { id: documentId },
        data: { 
          processed: true,
          processingStatus: 'COMPLETED_BASIC'
        },
      });
      
      console.log('Basic processing completed successfully');
    } catch (fallbackError) {
      console.error('Even basic processing failed:', fallbackError);
      await prisma.document.update({
        where: { id: documentId },
        data: { processingStatus: 'FAILED' }
      });
    }
  }
};

// Helper function to decide when to use AI
const shouldUseAIProcessing = (processedContent: ProcessedContent): boolean => {
  // Use AI for complex documents with many sections
  if (processedContent.metadata.sectionCount > 20) return true;
  
  // Use AI for documents with poor structure detection
  const headingSections = processedContent.structuredContent.filter(s => s.type === 'heading');
  if (headingSections.length < 3) return true; // Not enough headings detected
  
  // Use AI for very long documents
  if (processedContent.metadata.wordCount > 10000) return true;
  
  return false;
};

const processWithAI = async (text: string, documentId: string, mimeType: string) => {
  const structuredContent = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are a document analysis assistant. Analyze the following document text and identify chapters, sections, and their content. Return a structured JSON format with chapters and their content. Document type: ${mimeType}`
      },
      {
        role: "user",
        content: `Please analyze this document and extract chapters with their content. Here's the text:\n\n${text.substring(0, 12000)}`
      }
    ],
    max_tokens: 4000,
    temperature: 0.1,
  });

  console.log('OpenAI response received');
  const aiResponse = structuredContent.choices[0]?.message?.content;
  
  if (!aiResponse) {
    throw new Error('AI processing failed');
  }

  console.log('AI response length:', aiResponse.length);

  // Parse AI response and create chunks
  let chunks;
  try {
    console.log('Attempting to parse AI response as JSON');
    const parsedData = JSON.parse(aiResponse);
    console.log('JSON parsing successful');
    chunks = await createChunksFromAI(parsedData, documentId, text);
  } catch (parseError) {
    console.error('AI JSON parsing failed, using local processing:', parseError);
    // Fall back to local structured processing
    const processedContent = TextProcessor.processRawText(text, 'document');
    chunks = await createChunksFromStructuredContent(processedContent.structuredContent, documentId);
  }

  return chunks;
};

// Enhanced chunk creation from structured content (local processing)
const createChunksFromStructuredContent = async (
  structuredContent: StructuredSection[], 
  documentId: string
) => {
  const chunks = [];
  let currentChapter = 'Introduction';
  let currentContent = '';

  for (const section of structuredContent) {
    if (section.type === 'heading' && (section.level || 1) <= 2) {
      // Save previous chapter content if exists
      if (currentContent.trim()) {
        chunks.push({
          documentId,
          chapter: currentChapter,
          content: currentContent.trim(),
          pageNumber: section.pageNumber,
        });
        currentContent = '';
      }
      
      currentChapter = section.content;
    } else {
      // Add content to current chapter
      const formattedContent = TextProcessor.formatForDisplay([section]);
      currentContent += formattedContent + '\n';
    }
  }

  // Add the last chapter
  if (currentContent.trim()) {
    chunks.push({
      documentId,
      chapter: currentChapter,
      content: currentContent.trim(),
      pageNumber: structuredContent[structuredContent.length - 1]?.pageNumber || 1,
    });
  }

  return prisma.chunk.createMany({
    data: chunks,
  });
};

// Keep your existing createChunksFromAI function
const createChunksFromAI = async (aiData: any, documentId: string, fullText: string) => {
  const chunks = [];
  
  // Handle different possible AI response formats
  if (aiData.chapters && Array.isArray(aiData.chapters)) {
    for (const chapter of aiData.chapters) {
      if (chapter.title && chapter.content) {
        // Extract page number from content if possible
        const pageMatch = chapter.content.match(/\[PAGE (\d+)\]/);
        const pageNumber = pageMatch ? parseInt(pageMatch[1]) : 1;
        
        chunks.push({
          documentId,
          chapter: chapter.title,
          content: chapter.content.replace(/\[PAGE \d+\]/g, '').trim(),
          pageNumber,
        });
      }
    }
  } else if (typeof aiData === 'object') {
    // Handle other possible structures
    for (const [key, value] of Object.entries(aiData)) {
      if (typeof value === 'string') {
        const pageMatch = value.match(/\[PAGE (\d+)\]/);
        const pageNumber = pageMatch ? parseInt(pageMatch[1]) : 1;
        
        chunks.push({
          documentId,
          chapter: key,
          content: value.replace(/\[PAGE \d+\]/g, '').trim(),
          pageNumber,
        });
      }
    }
  }

  if (chunks.length === 0) {
    // Fallback to local processing if AI response format is unexpected
    const processedContent = TextProcessor.processRawText(fullText, 'document');
    return createChunksFromStructuredContent(processedContent.structuredContent, documentId);
  }

  return prisma.chunk.createMany({
    data: chunks,
  });
};

export const searchDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { query } = req.body;
    const { documentId } = req.params;
    const userId = (req.user as any).id;

    if (!query) {
      throw new BadRequestError('Search query is required');
    }
    
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (!document.processed) {
      throw new BadRequestError('Document is still being processed. Please try again later.');
    }

    // Get the most relevant chunks using semantic search
    const relevantChunks = await semanticSearch(query, documentId);
    
    // If we don't have enough relevant chunks, use keyword search as fallback
    let finalChunks = relevantChunks;
    if (relevantChunks.length < 2) {
      const keywordResults = await keywordSearch(query, documentId);
      finalChunks = [...relevantChunks, ...keywordResults]
        .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // Remove duplicates
        .slice(0, 5);
    }

    // Use AI to generate a concise answer based ONLY on the retrieved chunks
    const aiResponse = await generateContextualResponse(query, finalChunks, document.title);

    // Store search history
    const searchHistory = await prisma.searchHistory.create({
      data: {
        query,
        results: {
          chunks: finalChunks,
          aiResponse: aiResponse
        },
        documentId,
        userId,
      },
    });

    sendSuccessResponse(res, 'Search completed', {
      results: {
        chunks: finalChunks,
        answer: aiResponse
      },
      searchId: searchHistory.id,
    });
  } catch (error) {
    next(error);
  }
};

const generateContextualResponse = async (query: string, chunks: any[], documentTitle: string): Promise<string> => {
  try {
    // Prepare the context from retrieved chunks
    const context = chunks.map(chunk => 
      `[From ${chunk.chapter}, Page ${chunk.pageNumber}]: ${chunk.content.substring(0, 1000)}`
    ).join('\n\n');

    // Use OpenAI to generate a response strictly based on the context
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that answers questions based ONLY on the provided context from the document "${documentTitle}". 
          
          STRICT RULES:
          1. Answer ONLY using information from the provided context.
          2. If the answer cannot be found in the context, say "I cannot find this information in the document."
          3. Never make up information or use external knowledge.
          4. Cite the specific chapter and page number when possible.
          5. Be concise and directly answer the question.
          6. If the question is unclear or cannot be answered with the context, ask for clarification.`
        },
        {
          role: "user",
          content: `Context: ${context}\n\nQuestion: ${query}`
        }
      ],
      max_tokens: 500,
      temperature: 0.1, // Low temperature for more deterministic responses
    });

    const answer = response.choices[0]?.message?.content?.trim();
    
    if (!answer) {
      return "I couldn't generate a response based on the document content.";
    }

    // Additional safety check to prevent hallucination
    if (shouldRejectAnswer(answer, context)) {
      return "I cannot find this information in the document. Please try a different search query.";
    }

    return answer;

  } catch (error) {
    console.error('Error generating AI response:', error);
    // Fallback: return the most relevant chunk directly
    if (chunks.length > 0) {
      const mostRelevant = chunks[0];
      return `Based on "${mostRelevant.chapter}" (Page ${mostRelevant.pageNumber}): ${mostRelevant.content.substring(0, 300)}...`;
    }
    
    return "I couldn't find relevant information in the document for your query.";
  }
};

const semanticSearch = async (query: string, documentId: string) => {
  try {
    // Generate embedding for the query
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });

    const queryEmbedding = queryEmbeddingResponse.data[0]?.embedding;
    if (!queryEmbedding) return [];

    // Get all chunks for this document with embeddings
    const chunks = await prisma.chunk.findMany({
      where: { documentId, embedding: { not: null } },
    });

    // Calculate similarity and filter low-quality matches
    const chunksWithSimilarity = chunks.map((chunk:any) => {
      if (!chunk.embedding) return { ...chunk, similarity: 0 };
      
      const chunkEmbedding = JSON.parse(chunk.embedding);
      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
      
      return { ...chunk, similarity };
    });

    // Filter out low similarity results and return top chunks
    return chunksWithSimilarity
      .filter((chunk:any) => chunk.similarity > 0.7) // Higher threshold for better precision
      .sort((a:any, b:any) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(({ similarity, ...chunk }: any) => chunk);

  } catch (error) {
    console.error('Semantic search failed:', error);
    return [];
  }
};

const keywordSearch = async (query: string, documentId: string) => {
  const queryKeywords = query.toLowerCase().split(/\s+/)
    .filter(k => k.length > 3) // Longer keywords are more meaningful
    .filter(k => !isCommonWord(k));

  if (queryKeywords.length === 0) return [];

  const chunks = await prisma.chunk.findMany({
    where: { documentId },
  });

  return chunks
    .map((chunk:any) => {
      const chunkText = (chunk.chapter + ' ' + chunk.content).toLowerCase();
      
      // More sophisticated scoring: exact matches score higher
      const score = queryKeywords.reduce((total, keyword) => {
        const exactMatch = chunkText.includes(' ' + keyword + ' ') ? 2 : 0;
        const partialMatch = chunkText.includes(keyword) ? 1 : 0;
        return total + exactMatch + partialMatch;
      }, 0);
      
      return { ...chunk, score };
    })
    .filter((chunk:any) => chunk.score > 0)
    .sort((a:any, b:any) => b.score - a.score)
    .slice(0, 3)
    .map(({ score, ...chunk }:any) => chunk);
};

export const getSearchHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any).id;
    const { page = 1, limit = 10, documentId } = req.query;

    const where = { userId, ...(documentId && { documentId: String(documentId) }) };

    const searches = await prisma.searchHistory.findMany({
      where,
      include: {
        document: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.searchHistory.count({ where });

    sendSuccessResponse(res, 'Search history retrieved', {
      searches,
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

export const getDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any).id;
    const { page = 1, limit = 10 } = req.query;

    const documents = await prisma.document.findMany({
      where: { uploadedById: userId },
      orderBy: { uploadedAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.document.count({ where: { uploadedById: userId } });

    sendSuccessResponse(res, 'Documents retrieved', {
      documents,
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

export const getDocumentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, processed: true }
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    sendSuccessResponse(res, 'Document status retrieved', { document });
  } catch (error) {
    next(error);
  }
};


export const deleteDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const userId = (req.user as any).id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        chunks: {select: { id: true }},
        searches: {select: { id: true }},
        checklists: {select: { id: true }},
        notes: {select: { id: true }},
      }
    });

    if (!document) {
      throw new NotFoundError('Document not found');  
    }

        // Use a transaction to ensure all related data is deleted
    await prisma.$transaction(async (tx:any) => {
      // Delete all related data first (due to foreign key constraints)
      if (document.chunks.length > 0) {
        await tx.chunk.deleteMany({
          where: { documentId }
        });
        console.log(`Deleted ${document.chunks.length} chunks`);
      }

      if (document.searches.length > 0) {
        await tx.searchHistory.deleteMany({
          where: { documentId }
        });
        console.log(`Deleted ${document.searches.length} search histories`);
      }

      if (document.checklists.length > 0) {
        await tx.checklist.deleteMany({
          where: { documentId }
        });
        console.log(`Deleted ${document.checklists.length} checklist items`);
      }

      if (document.notes.length > 0) {
        await tx.note.deleteMany({
          where: { documentId }
        });
        console.log(`Deleted ${document.notes.length} notes`);
      }

      // Finally delete the document itself
      await tx.document.delete({
        where: { id: documentId }
      });
    });

      console.log(`Document ${documentId} deleted successfully`);
    sendSuccessResponse(res, 'Document and all related data deleted successfully');

  } catch (error) {
    console.error('Error deleting document:', error);
    next(error);
  }
};


export const getDocumentContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const { format = 'structured' } = req.query;
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (!document.content) {
      throw new BadRequestError('Document content not available');
    }

    let responseData: any = {};

    if (format === 'raw') {
      responseData = {
        content: document.content,
        format: 'raw'
      };
    } else if (format === 'formatted') {
      // Process on-the-fly for formatted display
      const processedContent = TextProcessor.processRawText(
        document.content,
        document.filename
      );
      responseData = {
        content: TextProcessor.formatForDisplay(processedContent.structuredContent),
        format: 'formatted'
      };
    } else {
      // Return structured content
      const processedContent = TextProcessor.processRawText(
        document.content,
        document.filename
      );
      responseData = {
        content: processedContent.structuredContent,
        metadata: processedContent.metadata,
        tableOfContents: TextProcessor.generateTableOfContents(processedContent.structuredContent),
        format: 'structured'
      };
    }

    sendSuccessResponse(res, 'Document content retrieved', responseData);
  } catch (error) {
    next(error);
  }
};

export const getDocumentTableOfContents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (!document.content) {
      throw new BadRequestError('Document content not available');
    }

    const processedContent = TextProcessor.processRawText(
      document.content,
      document.filename
    );

    const tableOfContents = TextProcessor.generateTableOfContents(
      processedContent.structuredContent
    );

    sendSuccessResponse(res, 'Table of contents retrieved', {
      tableOfContents,
      metadata: processedContent.metadata
    });
  } catch (error) {
    next(error);
  }
};