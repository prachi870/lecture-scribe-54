# Poster Generation Feature - Setup Guide

## Overview
The AI Poster Generation feature creates visual concept diagrams from lecture transcripts. It offers two visualization modes:
1. **Enhanced CSS Design** - Beautiful text-based posters with gradients, animations, and flow diagrams
2. **AI-Generated Images** - Creates actual poster images using Hugging Face's Stable Diffusion XL model

## Setup Instructions

### 1. Get Your Hugging Face API Key (Free!)

1. Visit https://huggingface.co/
2. Create a free account or sign in
3. Go to Settings → Access Tokens: https://huggingface.co/settings/tokens
4. Click "New token"
5. Give it a name (e.g., "Aura Learn Poster Generator")
6. Select "Read" permission (sufficient for inference API)
7. Click "Generate token"
8. Copy your token (starts with `hf_`)

### 2. Add API Key to Your Project

Open your `.env` file and add:

```bash
HUGGINGFACE_API_KEY=hf_your_token_here
```

Replace `hf_your_token_here` with your actual token.

### 3. Restart Development Server

After adding the key, restart your dev server:

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

## How to Use

1. **Upload or record a lecture** - The transcript will be automatically generated
2. **Navigate to the Poster tab** - You'll see it alongside Notes, Flashcards, etc.
3. **Click "Generate Poster"** - This creates the text-based poster with flow diagrams
4. **Click "Generate AI Image"** - This button appears after the text poster is ready
5. **Wait 15-30 seconds** - The AI model generates a visual poster image
6. **Download** - Once generated, you can download the image

## Features

### Text-Based Poster (Always Available)
- **Title & Description** - Overview of the lecture concept
- **Process Flow** - Step-by-step visual flow with connected lines
- **Key Concepts** - Important topics with emoji icons
- **Beautiful Design** - Gradients, animations, hover effects

### AI-Generated Image (Requires Hugging Face Key)
- **Visual Diagram** - AI-created educational poster
- **Professional Look** - Similar to ChatGPT's visual outputs
- **Downloadable** - Save as PNG for study materials

## Technical Details

- **Model**: Stable Diffusion XL Base 1.0
- **API**: Hugging Face Inference API (Free tier)
- **Storage**: Images stored as base64 in database
- **Cost**: Free (subject to Hugging Face rate limits)

## Troubleshooting

### "API key not configured" Error
- Make sure `HUGGINGFACE_API_KEY` is in your `.env` file
- Restart the development server after adding the key

### "Model is loading" Error
- Hugging Face models may take 20-30 seconds to wake up on first use
- Click "Generate AI Image" again after waiting

### Rate Limit Errors
- Free tier has rate limits
- Wait a few minutes before trying again
- Consider upgrading to Hugging Face Pro for higher limits

## Database Schema

The feature uses a `lecture_posters` table:

```sql
CREATE TABLE lecture_posters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  concepts JSONB,
  flow_steps JSONB,
  diagram_type TEXT,
  image_url TEXT,
  generated_at TIMESTAMP DEFAULT NOW()
);
```

## Files Modified

- `src/components/lectures/poster-panel.tsx` - UI component
- `src/lib/lectures.functions.ts` - Backend functions
- `src/routes/_authenticated/lectures.$id.tsx` - Route integration
- `supabase/migrations/20261111_add_lecture_posters.sql` - Database schema

---

**Note**: This feature does NOT modify any existing functionality. All other features (Notes, Flashcards, Quiz, etc.) continue to work exactly as before.
