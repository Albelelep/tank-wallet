function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function repairToolArguments(toolName, args) {
  // Best-effort repair for common model mistakes. Keep this tightly scoped and conservative.
  if (!isObject(args)) return args;

  // Models often flatten offer fields (have/want/btc_sats/...) at the top-level for offer_post.
  // The schema requires these to live under offers[].
  if (toolName === 'intercomswap_offer_post') {
    const out = { ...args };
    // Some models use "channel" (singular) instead of "channels" (array).
    if (!Array.isArray(out.channels) && typeof out.channel === 'string' && out.channel.trim()) {
      out.channels = [out.channel.trim()];
      delete out.channel;
    }

    const offerKeys = [
      'pair',
      'have',
      'want',
      'btc_sats',
      'usdt_amount',
      'max_platform_fee_bps',
      'max_trade_fee_bps',
      'max_total_fee_bps',
      'min_sol_refund_window_sec',
      'max_sol_refund_window_sec',
    ];
    const flattened = offerKeys.filter((k) => k in out);
    if (flattened.length > 0) {
      // Always delete flattened top-level keys; executor rejects them.
      if (!Array.isArray(out.offers) || out.offers.length === 0 || !isObject(out.offers[0])) {
        const o = {};
        for (const k of flattened) o[k] = out[k];
        out.offers = [o];
      } else {
        // Merge into offers[0] only if the key is missing there (avoid silent overrides).
        const merged = { ...(out.offers[0] || {}) };
        for (const k of flattened) {
          if (!(k in merged)) merged[k] = out[k];
        }
        out.offers = [merged].concat(out.offers.slice(1));
      }
      for (const k of flattened) delete out[k];
    } else if (!Array.isArray(out.offers)) {
      // If offers is missing entirely, but there were no flattened keys, leave as-is and let schema validation fail.
    }
    return out;
  }

  return args;
}

