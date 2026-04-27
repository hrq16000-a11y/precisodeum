import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find users with portfolio media but no albums
    const { data: mediaUsers, error: mediaErr } = await supabase
      .from("media")
      .select("user_ref")
      .eq("entity_type", "portfolio")
      .eq("is_active", true)
      .not("user_ref", "is", null)
      .neq("user_ref", "unlinked");

    if (mediaErr) throw mediaErr;

    // Unique user_refs
    const uniqueRefs = [...new Set((mediaUsers || []).map((m: any) => m.user_ref))];
    
    let albumsCreated = 0;
    let photosLinked = 0;
    let providersUpdated = 0;
    const errors: string[] = [];

    for (const userRef of uniqueRefs) {
      try {
        // Get profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_ref", userRef)
          .maybeSingle();
        if (!profile) continue;

        // Get provider
        const { data: provider } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", profile.id)
          .is("deleted_at", null)
          .maybeSingle();
        if (!provider) continue;

        // Check if already has albums
        const { count: albumCount } = await supabase
          .from("portfolio_albums")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", provider.id);

        if ((albumCount ?? 0) > 0) continue;

        // Get all portfolio media for this user
        const { data: photos } = await supabase
          .from("media")
          .select("public_url, storage_path, original_name")
          .eq("user_ref", userRef)
          .eq("entity_type", "portfolio")
          .eq("is_active", true)
          .order("created_at");

        if (!photos || photos.length === 0) continue;

        // Create album
        const { data: album, error: albumErr } = await supabase
          .from("portfolio_albums")
          .insert({
            provider_id: provider.id,
            user_id: profile.id,
            name: "Meus Trabalhos",
            description: "Álbum migrado automaticamente",
            display_order: 0,
          })
          .select("id")
          .single();

        if (albumErr) {
          errors.push(`Album error for ${userRef}: ${albumErr.message}`);
          continue;
        }

        albumsCreated++;

        // Insert portfolio_photos
        const photoRecords = photos.map((p: any, i: number) => ({
          album_id: album.id,
          user_id: profile.id,
          image_url: p.public_url,
          storage_path: p.storage_path || "",
          original_name: p.original_name || "foto.jpg",
          display_order: i,
        }));

        const { error: photosErr } = await supabase
          .from("portfolio_photos")
          .insert(photoRecords);

        if (photosErr) {
          errors.push(`Photos error for ${userRef}: ${photosErr.message}`);
          continue;
        }

        photosLinked += photos.length;

        // Update provider counters
        await supabase
          .from("providers")
          .update({
            portfolio_album_count: 1,
            portfolio_photo_count: photos.length,
          })
          .eq("id", provider.id);

        providersUpdated++;
      } catch (e) {
        errors.push(`Error for ${userRef}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalUsersWithMedia: uniqueRefs.length,
        albumsCreated,
        photosLinked,
        providersUpdated,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
