// Minimal Vercel serverless function — test if function boots at all
export default function handler(req: any, res: any) {
  res.status(200).json({
    status: "ok",
    vercel: !!process.env.VERCEL,
    hasDbUrl: !!process.env.DATABASE_URL,
    hasJwt: !!process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
