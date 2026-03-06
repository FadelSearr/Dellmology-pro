import { NextRequest, NextResponse } from 'next/server'
import { readCoolingOffLockState } from '@/lib/security/coolingOff'
import { buildCoolingOffLockPayload } from '@/lib/security/lockPayloads'
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { readCoolingOffLockState } from '@/lib/security/coolingOff';
import { buildCoolingOffLockPayload } from '@/lib/security/lockPayloads';


export async function POST(request: NextRequest) {
// Proxy /generate-narrative to the ML engine XAI /narrative endpoint.
export async function POST(request: NextRequest) {
  try {
    const coolingOff = await readCoolingOffLockState()
    if (coolingOff.active) {
      return NextResponse.json(buildCoolingOffLockPayload(coolingOff, 'Cooling-off active: recommendation temporarily locked', true), {
        status: 423,
      })
    }

    const body = await request.json()
    const symbol = body?.symbol
    if (!symbol) return NextResponse.json({ success: false, error: 'symbol required' }, { status: 400 })

    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001'

    const resp = await fetch(`${ML_ENGINE_URL}/xai/narrative`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ML_ENGINE_KEY || ''}`,
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json({ success: false, error: text }, { status: resp.status })
    }

    const json = await resp.json()
    return NextResponse.json({ success: true, narrative: json.narrative || json }, { status: 200 })
  } catch (err) {
    console.error('Generate narrative proxy error', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
  
  try {
    const coolingOff = await readCoolingOffLockState();
    if (coolingOff.active) {
      return NextResponse.json(buildCoolingOffLockPayload(coolingOff, 'Cooling-off active: recommendation temporarily locked', true), {
        status: 423,
      });
    }

      const body = await request.json();
      const { symbol, date, data } = body as { symbol?: string; date?: string; data?: unknown };

    if (!symbol || !date || !data) {
      return NextResponse.json(
        { success: false, error: "Symbol, date, and data are required." },
        { status: 400 }
      );
    }
    
    // --- Sanity Check Layer Mitigation ---
    if (!Array.isArray(data) || data.length < MIN_BROKERS_FOR_ANALYSIS) {
      return NextResponse.json(
        { success: false, error: `Insufficient data for analysis. At least ${MIN_BROKERS_FOR_ANALYSIS} broker records are required.` },
        { status: 422 } // 422 Unprocessable Entity
      );
    }
    
    const dataArray = data as BrokerSummary[];
    const totalNet = dataArray.reduce((acc, cur) => acc + Number(cur.net_buy_value ?? 0), 0);
    if (Math.abs(totalNet) > MAX_NET_VALUE_THRESHOLD) {
        return NextResponse.json(
        { success: false, error: `Data failed sanity check. Total net value is outside the acceptable range.` },
        { status: 422 }
      );
    }
    // --- End Mitigation ---

    // 2. Initialize Google AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 3. Create Prompt and Generate Content
    const prompt = createPrompt(symbol, date, data);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // 4. Return the result
    return NextResponse.json(
      { success: true, narrative: text },
      { status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("AI Narrative Generation Error:", error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate AI narrative.', details: errorMessage },
      { status: 500 }
    );
  }
}
