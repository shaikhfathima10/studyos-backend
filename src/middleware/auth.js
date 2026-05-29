import { createClient } from "@supabase/supabase-js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.split(" ")[1];

    // Create fresh client with anon key to verify user token
    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      console.log("Auth error:", error?.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.log("Auth catch error:", err.message);
    res.status(401).json({ error: "Authentication failed" });
  }
}