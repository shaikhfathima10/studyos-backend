import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const MODELS = {
  claude: "claude-opus-4-5",
  openai: "gpt-4o-mini",
};