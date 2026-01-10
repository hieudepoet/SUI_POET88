/**
 * LLM Analyzer Service
 * 
 * Uses OpenAI (or compatible API) to analyze user prompts and extract metadata
 * for agent matching.
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Interface for the analyzed request data
export interface AnalyzedRequest {
    summary: string;          // Refined task description
    skills: string[];         // Required skills tag list
    estimatedBudget: number;  // Estimated budget in USDC
    complexity: 'low' | 'medium' | 'high';
}

export class LlmAnalyzer {
    private openai: OpenAI | null = null;
    
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.openai = new OpenAI({
                apiKey: apiKey,
                // Optional: Allow base URL override for other providers (DeepSeek, OpenRouter, etc.)
                baseURL: process.env.LLM_BASE_URL 
            });
        } else {
            console.warn('[LLM] OPENAI_API_KEY not found. Using fallback keyword matching.');
        }
    }

    /**
     * Analyze a natural language request
     */
    async analyze(userPrompt: string): Promise<AnalyzedRequest> {
        // Fallback if no LLM configured
        if (!this.openai) {
            return this.fallbackAnalyze(userPrompt);
        }

        try {
            console.log(`[LLM] Analyzing prompt: "${userPrompt.substring(0, 50)}..."`);
            
            const completion = await this.openai.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are an expert AI project manager for a freelance marketplace. 
                        Your job is to analyze user requests and extract structured metadata to find the best agent.
                        
                        OUTPUT JSON ONLY with this structure:
                        {
                            "summary": "Concise professional summary of the task (max 10 words)",
                            "skills": ["skill1", "skill2", "skill3"], (max 5 most relevant skills, lowercase)
                            "estimatedBudget": 50, (Estimate fair price in USDC based on task complexity. Range: 1-1000. Be extremely cheap/efficient: Simple tasks < $50, Medium < $200)
                            "complexity": "low" | "medium" | "high"
                        }
                        
                        Example Input: "I need a simple landing page for my crypto project"
                        Example Output: {"summary": "Crypto project landing page development", "skills": ["react", "tailwind", "web3"], "estimatedBudget": 30, "complexity": "low"}`
                    },
                    { role: "user", content: userPrompt }
                ],
                model: process.env.LLM_MODEL || "gpt-3.5-turbo", // Use simpler model for speed/cost
                response_format: { type: "json_object" },
                temperature: 0.2, // Low temperature for consistent output
            });

            const content = completion.choices[0].message.content;
            if (!content) throw new Error('Empty response from LLM');

            const result = JSON.parse(content) as AnalyzedRequest;
            console.log('[LLM] Analysis result:', result);
            
            return result;

        } catch (error) {
            console.error('[LLM] Analysis failed:', error);
            return this.fallbackAnalyze(userPrompt);
        }
    }

    /**
     * Simple keyword-based fallback if LLM fails or is not configured
     */
    private fallbackAnalyze(prompt: string): AnalyzedRequest {
        const lower = prompt.toLowerCase();
        const skills: string[] = [];
        
        // Basic keyword matching
        if (lower.includes('website') || lower.includes('web') || lower.includes('landing')) skills.push('react', 'frontend');
        if (lower.includes('app') || lower.includes('mobile')) skills.push('mobile', 'react native');
        if (lower.includes('design') || lower.includes('logo') || lower.includes('ui')) skills.push('design', 'figma');
        if (lower.includes('smart contract') || lower.includes('token') || lower.includes('nft')) skills.push('blockchain', 'solidity');
        if (lower.includes('bug') || lower.includes('fix')) skills.push('debugging');
        
        if (skills.length === 0) skills.push('general');

        let budget = 50; // Default low budget
        if (lower.includes('complex') || lower.includes('full stack')) budget = 200;
        if (lower.includes('simple') || lower.includes('small')) budget = 20;

        return {
            summary: prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt,
            skills,
            estimatedBudget: budget,
            complexity: budget > 100 ? 'high' : (budget > 40 ? 'medium' : 'low')
        };
    }
}
