"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbeddingsForChunks = exports.createChunksFromText = exports.shouldRejectAnswer = exports.cosineSimilarity = exports.isCommonWord = exports.extractPageNumber = exports.pageRenderWithPageNumber = void 0;
const prisma_1 = __importDefault(require("../prisma"));
// Helper function to get page numbers during PDF parsing
const pageRenderWithPageNumber = (pageData) => {
    const renderOptions = {
        normalizeWhitespace: false,
        disableCombineTextItems: false
    };
    return pageData.getTextContent(renderOptions).then((textContent) => {
        let lastY = null;
        let text = '';
        let currentPage = pageData.pageIndex + 1;
        for (const item of textContent.items) {
            if (lastY !== item.transform[5]) {
                if (lastY !== null)
                    text += '\n';
                lastY = item.transform[5];
            }
            text += item.str + ' ';
        }
        return `[PAGE ${currentPage}] ${text}\n\n`;
    });
};
exports.pageRenderWithPageNumber = pageRenderWithPageNumber;
const extractPageNumber = (text) => {
    const pageMatch = text.match(/\[PAGE (\d+)\]/);
    return pageMatch ? parseInt(pageMatch[1]) : null;
};
exports.extractPageNumber = extractPageNumber;
const isCommonWord = (word) => {
    const commonWords = new Set([
        'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'what', 'when',
        'where', 'why', 'how', 'which', 'who', 'their', 'there', 'about', 'because'
    ]);
    return commonWords.has(word.toLowerCase());
};
exports.isCommonWord = isCommonWord;
const cosineSimilarity = (a, b) => {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
};
exports.cosineSimilarity = cosineSimilarity;
const shouldRejectAnswer = (answer, context) => {
    // Safety checks to prevent hallucination
    const rejectionPatterns = [
        /(I don't know|I'm not sure|I cannot answer|outside of my|based on my knowledge)/i,
        /(as an AI|as a language model)/i,
        /(in general|typically|usually|often)/i
    ];
    // Check if answer contains phrases suggesting hallucination
    if (rejectionPatterns.some(pattern => pattern.test(answer))) {
        return true;
    }
    // Check if answer introduces completely new concepts not in context
    const answerWords = new Set(answer.toLowerCase().split(/\s+/));
    const contextWords = new Set(context.toLowerCase().split(/\s+/));
    // Count unique words in answer that aren't in context
    const novelWords = Array.from(answerWords).filter(word => word.length > 5 && !contextWords.has(word) && !(0, exports.isCommonWord)(word));
    // If too many novel concepts, reject the answer
    return novelWords.length > 3;
};
exports.shouldRejectAnswer = shouldRejectAnswer;
const createChunksFromText = async (text, documentId) => {
    // Enhanced regex pattern to detect various chapter formats
    const chapterRegex = /(^|\n)((CHAPTER|Chapter|Section|Part|UNIT|Lesson)\s+[IVXLCDM0-9A-Z]+([.:\-])?\s*.+|\d+\.\d*\.?\s*[A-Z][^\n]+)/gi;
    const matches = [];
    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
        matches.push({
            index: match.index,
            text: match[0].trim(),
        });
    }
    const chunks = [];
    let lastIndex = 0;
    // Create introduction chunk if there's content before first chapter
    if (matches.length > 0 && matches[0].index > 0) {
        const introContent = text.substring(0, matches[0].index).trim();
        if (introContent) {
            const pageNumber = (0, exports.extractPageNumber)(introContent);
            chunks.push({
                documentId,
                chapter: 'Introduction',
                content: introContent.replace(/\[PAGE \d+\]/g, '').trim(),
                pageNumber: pageNumber || 1,
            });
        }
        lastIndex = matches[0].index;
    }
    // Process each chapter
    for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        const endIndex = nextMatch ? nextMatch.index : text.length;
        const chapterContent = text.substring(currentMatch.index, endIndex).trim();
        const pageNumber = (0, exports.extractPageNumber)(chapterContent);
        chunks.push({
            documentId,
            chapter: currentMatch.text,
            content: chapterContent.replace(/\[PAGE \d+\]/g, '').trim(),
            pageNumber: pageNumber || 1,
        });
        lastIndex = endIndex;
    }
    // Add remaining content as appendix
    if (lastIndex < text.length) {
        const remainingContent = text.substring(lastIndex).trim();
        if (remainingContent) {
            const pageNumber = (0, exports.extractPageNumber)(remainingContent);
            chunks.push({
                documentId,
                chapter: 'Appendix',
                content: remainingContent.replace(/\[PAGE \d+\]/g, '').trim(),
                pageNumber: pageNumber || 1,
            });
        }
    }
    return prisma_1.default.chunk.createMany({
        data: chunks,
    });
};
exports.createChunksFromText = createChunksFromText;
const generateEmbeddingsForChunks = async (documentId, openai) => {
    try {
        const chunks = await prisma_1.default.chunk.findMany({
            where: { documentId },
        });
        for (const chunk of chunks) {
            try {
                // Generate embedding using OpenAI
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-ada-002",
                    input: `${chunk.chapter}: ${chunk.content.substring(0, 8000)}`, // Limit content length
                });
                const embedding = embeddingResponse.data[0]?.embedding;
                if (embedding) {
                    // Store embedding as JSON string
                    await prisma_1.default.chunk.update({
                        where: { id: chunk.id },
                        data: { embedding: JSON.stringify(embedding) },
                    });
                }
            }
            catch (error) {
                console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error);
            }
        }
    }
    catch (error) {
        console.error('Error generating embeddings:', error);
    }
};
exports.generateEmbeddingsForChunks = generateEmbeddingsForChunks;
