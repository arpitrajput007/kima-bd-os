// ── Pluto's Customers — AERpolice BD Target List ─────────────────────
// 52 AI-agent companies from Pluto's manually curated prospecting sheet
// (2026-08-25), filtered to rows tagged "Aerpolice" in the "Product" column.
// Source: https://docs.google.com/spreadsheets/d/1x7Eki8ff6AUDZRgIZ3EasMpqvXJLLiyfOiy6ZFVRkEw
//
// The sheet has no company-name column — `company` is derived from the
// website domain. A block of rows (roughly Naven onward) has its "X Link"
// column shifted relative to "Website" by one row in the source sheet, so
// `twitter` may not always belong to the same company as `website` in that
// stretch — verify before using it in outreach. `website` and `contact` are
// reliable as entered.

export interface PlutoAerpoliceCustomer {
  id: number
  company: string
  website: string
  twitter: string
  contact: string
  platform: string
  status: string
}

export const PLUTO_AERPOLICE_CUSTOMERS: PlutoAerpoliceCustomer[] = [
  { id: 1, company: 'Gizatech', website: 'https://www.gizatech.xyz/', twitter: 'https://x.com/gizatechxyz', contact: 'https://www.linkedin.com/company/gizatech/posts/?feedView=all', platform: 'Linkedin', status: '' },
  { id: 2, company: 'Almanak', website: 'https://almanak.co/', twitter: 'https://x.com/Almanak__', contact: '@the_hand_of_nidas', platform: 'Telegram', status: 'Sent' },
  { id: 3, company: 'Heyanon', website: 'https://heyanon.ai/', twitter: 'https://x.com/HeyAnonai', contact: '@crypto_anita', platform: 'Telegram', status: '' },
  { id: 4, company: 'Griffain', website: 'https://griffain.com/', twitter: 'https://x.com/griffaindotcom', contact: '', platform: '', status: '' },
  { id: 5, company: 'Olas', website: 'https://olas.network/', twitter: 'https://x.com/autonolas', contact: '', platform: '', status: '' },
  { id: 6, company: 'Elizaos', website: 'https://elizaos.ai/', twitter: 'https://x.com/elizaOS', contact: 'hello@elizaresearch.ai', platform: 'Email', status: '' },
  { id: 7, company: 'Bankr', website: 'https://bankr.bot/', twitter: 'https://x.com/bankrbot', contact: '0xfrenchie', platform: 'Discord', status: '' },
  { id: 8, company: 'Brianknows', website: 'https://www.brianknows.org/', twitter: 'https://x.com/BrianknowsAI', contact: '', platform: '', status: '' },
  { id: 9, company: 'Enso', website: 'https://www.enso.build/', twitter: 'https://x.com/EnsoBuild', contact: 'javierdddd', platform: 'Discord', status: '' },
  { id: 10, company: 'Singularitydao', website: 'https://www.singularitydao.ai/', twitter: 'https://x.com/SingularityDAO', contact: '', platform: '', status: '' },
  { id: 11, company: 'Kryll', website: 'https://kryll.io/', twitter: 'https://x.com/kryll_io', contact: 'https://t.me/SveinKryll', platform: 'Telegram', status: '' },
  { id: 12, company: 'Nunchi', website: 'https://nunchi.trade', twitter: 'https://x.com/nunchi', contact: 'info@nunchi.trade', platform: 'Email', status: '' },
  { id: 13, company: 'Fereai', website: 'https://www.fereai.xyz', twitter: 'https://x.com/fere_ai', contact: 'https://www.linkedin.com/company/fereai/', platform: 'Linkedin', status: '' },
  { id: 14, company: 'Justbeep', website: 'https://www.justbeep.it', twitter: 'https://x.com/0xbeepit', contact: 'https://t.me/JackLD', platform: 'Telegram', status: '' },
  { id: 15, company: 'Hyperagent', website: 'https://hyperagent.com', twitter: 'https://x.com/hyperagentapp', contact: 'https://www.linkedin.com/company/hyperagentapp/', platform: 'Linkedin', status: '' },
  { id: 16, company: 'Nof1', website: 'https://nof1.ai', twitter: 'https://x.com/the_nof1', contact: '', platform: '', status: '' },
  { id: 17, company: 'Aipaywithcrypto', website: 'https://aipaywithcrypto.com', twitter: 'https://x.com/edgeagentbot', contact: '', platform: '', status: '' },
  { id: 18, company: 'Agentum', website: 'https://agentum.space', twitter: 'https://x.com/Orion_Agents', contact: '', platform: '', status: '' },
  { id: 19, company: 'Termix', website: 'https://termix.ai', twitter: 'https://x.com/Agentum_space', contact: '', platform: '', status: '' },
  { id: 20, company: 'Leonisai', website: 'https://leonisai.xyz', twitter: 'https://x.com/termix_ai', contact: '', platform: '', status: '' },
  { id: 21, company: 'Paythefly', website: 'https://paythefly.com', twitter: 'https://x.com/Leonisai_xyz', contact: 'https://t.me/coinjeanok', platform: 'Telegram', status: '' },
  { id: 22, company: 'Turnkey', website: 'https://www.turnkey.com', twitter: 'https://x.com/PayAll_AI', contact: 'https://www.linkedin.com/company/turnkeyhq/', platform: 'Linkedin', status: '' },
  { id: 23, company: 'Naven', website: 'https://naven.network', twitter: 'https://x.com/xona_agent', contact: '', platform: '', status: '' },
  { id: 24, company: 'Shopagentic', website: 'https://shopagentic.com', twitter: 'https://x.com/NavenNetwork', contact: 'https://www.linkedin.com/company/shopagentic/', platform: 'Linkedin', status: '' },
  { id: 25, company: 'Agenticzero', website: 'https://agenticzero.xyz', twitter: 'https://x.com/ShopAgentic', contact: 'https://www.linkedin.com/company/agentic-zero-ai', platform: 'Linkedin', status: '' },
  { id: 26, company: 'Lokyai', website: 'https://lokyai.com', twitter: 'https://x.com/AgenticZero', contact: '@napolean0', platform: 'Telegram', status: '' },
  { id: 27, company: 'Gokite', website: 'https://gokite.ai', twitter: 'https://x.com/Loky_AI', contact: 'https://www.linkedin.com/company/gokiteai', platform: 'Linkedin', status: '' },
  { id: 28, company: 'Creao', website: 'https://creao.ai', twitter: 'https://x.com/GoKiteAI', contact: 'https://www.linkedin.com/company/creaoai/', platform: 'Linkedin', status: '' },
  { id: 29, company: 'Agentcash', website: 'https://agentcash.dev', twitter: 'https://x.com/CreaoAI', contact: '', platform: '', status: '' },
  { id: 30, company: 'Daydreams', website: 'https://daydreams.systems', twitter: 'https://x.com/agentcashdev', contact: 'loaf1337', platform: 'Discord', status: '' },
  { id: 31, company: 'Tlay', website: 'https://www.tlay.io', twitter: 'https://x.com/daydreamsagents', contact: 'info@tlay.io', platform: 'Email', status: '' },
  { id: 32, company: 'Agenticbull', website: 'https://agenticbull.stocktrends.com', twitter: 'https://x.com/tlay_io', contact: '', platform: '', status: '' },
  { id: 33, company: 'Syraa', website: 'https://docs.syraa.fun', twitter: 'https://x.com/AgenticBull', contact: '', platform: '', status: '' },
  { id: 34, company: 'Circle', website: 'https://circle.com/', twitter: 'https://x.com/syra_agent', contact: 'https://www.linkedin.com/company/circle-internet-financial/', platform: 'Linkedin', status: '' },
  { id: 35, company: 'Pesapal', website: 'https://www.pesapal.com', twitter: 'https://x.com/bloopa_xyz', contact: 'info@pesapal.com', platform: 'Email', status: '' },
  { id: 36, company: 'Autonolas', website: 'https://www.autonolas.network', twitter: 'https://x.com/agentcashdev', contact: '@virusdonotclick', platform: 'Telegram', status: '' },
  { id: 37, company: 'Privy', website: 'https://www.privy.io', twitter: 'https://x.com/autonolas', contact: '', platform: '', status: '' },
  { id: 38, company: 'Orbs', website: 'https://www.orbs.com', twitter: 'https://x.com/NEARProtocol', contact: '', platform: '', status: '' },
  { id: 39, company: 'Virtuals', website: 'https://www.virtuals.io', twitter: 'https://x.com/orbs_network', contact: '@fiatisabubble', platform: 'Telegram', status: '' },
  { id: 40, company: 'Almanak Docs', website: 'https://docs.almanak.co', twitter: 'https://x.com/virtuals_io', contact: '@the_hand_of_nidas', platform: 'Telegram', status: '' },
  { id: 41, company: 'Wayfinder', website: 'https://wayfinder.ai', twitter: 'https://x.com/almanak', contact: 'wayfinderfoundation', platform: 'Discord', status: '' },
  { id: 42, company: 'Bankr.bot', website: 'https://bankr.bot', twitter: 'https://x.com/AIWayfinder', contact: '0xfrenchie', platform: 'Discord', status: '' },
  { id: 43, company: 'Cobo', website: 'https://www.cobo.com', twitter: 'https://x.com/bankrbot', contact: '', platform: '', status: '' },
  { id: 44, company: 'Solana x402', website: 'https://solana.com/x402', twitter: 'https://x.com/Neyro_Network', contact: '', platform: '', status: '' },
  { id: 45, company: 'Hoodusdp', website: 'https://hoodusdp.com/', twitter: 'https://x.com/agentlayer_ai', contact: '', platform: '', status: '' },
  { id: 46, company: 'Agentcash.dev', website: 'https://agentcash.dev/', twitter: 'https://x.com/BlockRunAI', contact: '', platform: '', status: '' },
  { id: 47, company: 'Omniclaw', website: 'https://www.omniclaw.ai/', twitter: 'https://x.com/agentcashdev', contact: 'https://www.omniclaw.ai/contact#', platform: 'Linkedin', status: '' },
  { id: 48, company: 'Runepool', website: 'https://runepool.ai', twitter: 'https://x.com/useOmniClaw', contact: '', platform: '', status: '' },
  { id: 49, company: 'Enzyme', website: 'https://enzyme.finance/', twitter: 'https://x.com/Virtuals_io', contact: 'http://linkedin.enzyme.finance/', platform: 'Linkedin', status: '' },
  { id: 50, company: 'Bvnk', website: 'https://bvnk.com/', twitter: 'https://x.com/Zerion', contact: 'https://www.linkedin.com/company/bvnk/', platform: 'Linkedin', status: '' },
  { id: 51, company: 'Ampersend', website: 'https://ampersend.ai/', twitter: 'https://x.com/ampersend_ai', contact: '@kevinjonescreates', platform: 'Telegram', status: '' },
  { id: 52, company: 'Getdonut', website: 'https://getdonut.ai/', twitter: 'https://x.com/DonutAI', contact: '@donutqueenluna', platform: 'Telegram', status: '' },
]
