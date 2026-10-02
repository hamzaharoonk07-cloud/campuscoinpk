/* ---------------------------------------------------------------------------
   Brand logos for transactions that name a company ("Netflix share",
   "Foodpanda dinner"), so the list shows the logo a student recognises
   instead of a generic category icon.

   The logos are from Simple Icons (CC0, bundled with the app, nothing is
   fetched). Brands that set does not carry - Careem, inDrive, Daraz, the
   Pakistani wallets and food chains, and a few that asked Simple Icons to
   remove theirs - get a tile in their brand colour with their initials
   instead of an imitation logo.
   The logos only identify the merchant; Campus Coin is not affiliated.
--------------------------------------------------------------------------- */

import {
  siAirbnb,
  siApple,
  siBurgerking,
  siCoursera,
  siDuolingo,
  siEpicgames,
  siFiverr,
  siFoodpanda,
  siGithub,
  siGoogle,
  siGoogledrive,
  siIcloud,
  siInstagram,
  siKfc,
  siMcdonalds,
  siNetflix,
  siNotion,
  siPaypal,
  siPlaystation,
  siPubg,
  siSpotify,
  siStarbucks,
  siSteam,
  siTelenor,
  siTiktok,
  siUber,
  siUdemy,
  siUpwork,
  siYoutube,
  siZoom,
} from 'simple-icons';

// Checked in order, so the more specific names come first.
const BRANDS = [
  { match: /netflix/i, icon: siNetflix },
  { match: /spotify/i, icon: siSpotify },
  { match: /youtube/i, icon: siYoutube },
  { match: /food ?panda/i, icon: siFoodpanda },
  { match: /\buber\b/i, icon: siUber },
  { match: /careem/i, name: 'Careem', hex: '37B44A', letter: 'C' },
  { match: /in ?drive/i, name: 'inDrive', hex: 'C1F11D', letter: 'iD', dark: true },
  { match: /bykea/i, name: 'Bykea', hex: '1BB55C', letter: 'B' },
  { match: /daraz/i, name: 'Daraz', hex: 'F85606', letter: 'D' },
  { match: /amazon/i, name: 'Amazon', hex: '232F3E', letter: 'a' },
  { match: /jazz ?cash/i, name: 'JazzCash', hex: 'E4002B', letter: 'JC' },
  { match: /easy ?paisa/i, name: 'Easypaisa', hex: '3BB54A', letter: 'e' },
  { match: /sada ?pay/i, name: 'SadaPay', hex: '00D9A6', letter: 'S', dark: true },
  { match: /naya ?pay/i, name: 'NayaPay', hex: '6C2BD9', letter: 'N' },
  { match: /zindigi/i, name: 'Zindigi', hex: '00E0B8', letter: 'Z', dark: true },
  { match: /\bu-?paisa\b/i, name: 'UPaisa', hex: 'F58220', letter: 'Up' },
  { match: /konnect/i, name: 'Konnect', hex: '00984A', letter: 'K' },

  /* The banks a student is most likely to type - a tile in the bank's own
     colour with its short name, the same brand-mark style the wallets above
     use. These are coloured initials, not a reproduction of any bank's
     actual logo. Specific names, so the order among them does not matter. */
  { match: /\bhbl\b|habib bank/i, name: 'HBL', hex: '00984A', letter: 'HBL' },
  { match: /\bubl\b|united bank/i, name: 'UBL', hex: '005DA4', letter: 'UBL' },
  { match: /\bmcb\b|muslim commercial/i, name: 'MCB', hex: '00954C', letter: 'MCB' },
  { match: /meezan/i, name: 'Meezan Bank', hex: '005B41', letter: 'MB' },
  { match: /allied bank|\babl\b/i, name: 'Allied Bank', hex: '00A79D', letter: 'ABL' },
  { match: /alfalah/i, name: 'Bank Alfalah', hex: 'D6002A', letter: 'BAF' },
  { match: /faysal/i, name: 'Faysal Bank', hex: '006B3F', letter: 'FB' },
  { match: /askari/i, name: 'Askari Bank', hex: '005DAA', letter: 'AKBL' },
  { match: /standard chartered|\bscb\b/i, name: 'Standard Chartered', hex: '0473EA', letter: 'SC' },
  { match: /bank ?islami/i, name: 'BankIslami', hex: '00953B', letter: 'BI' },
  { match: /dubai islamic|\bdib\b/i, name: 'Dubai Islamic', hex: '00843D', letter: 'DIB' },
  { match: /soneri/i, name: 'Soneri Bank', hex: 'E2001A', letter: 'SB' },
  { match: /\bjs bank\b/i, name: 'JS Bank', hex: '00A94F', letter: 'JS' },
  { match: /habib ?metro|metropolitan/i, name: 'Habib Metro', hex: '003DA5', letter: 'HM' },
  { match: /national bank|\bnbp\b/i, name: 'National Bank', hex: '00843D', letter: 'NBP' },
  { match: /bank of punjab|\bbop\b/i, name: 'Bank of Punjab', hex: '00A651', letter: 'BOP' },
  { match: /\bsindh bank\b/i, name: 'Sindh Bank', hex: '00573F', letter: 'SNB' },
  { match: /silk ?bank/i, name: 'Silkbank', hex: '662D91', letter: 'SILK' },
  { match: /cheezious/i, name: 'Cheezious', hex: 'FFC20E', letter: 'C', dark: true },
  { match: /savour/i, name: 'Savour Foods', hex: 'D71920', letter: 'S' },
  { match: /pizza ?hut/i, name: 'Pizza Hut', hex: 'EE3124', letter: 'PH' },
  { match: /domino/i, name: "Domino's", hex: '006491', letter: 'D' },
  { match: /subway/i, name: 'Subway', hex: '008C15', letter: 'S' },
  { match: /hardee/i, name: "Hardee's", hex: 'E31837', letter: 'H' },
  { match: /gloria jean/i, name: "Gloria Jean's", hex: '5A2D0C', letter: 'GJ' },
  { match: /imtiaz/i, name: 'Imtiaz', hex: 'E30613', letter: 'I' },
  { match: /\bptcl\b/i, name: 'PTCL', hex: '0F75BC', letter: 'P' },
  { match: /\bzong\b/i, name: 'Zong', hex: '8DC63F', letter: 'Z', dark: true },
  { match: /\bufone\b/i, name: 'Ufone', hex: 'F58220', letter: 'U' },
  { match: /\bjazz\b/i, name: 'Jazz', hex: 'ED1C24', letter: 'J' },
  { match: /telenor/i, icon: siTelenor },
  { match: /k-?electric/i, name: 'K-Electric', hex: 'E2231A', letter: 'KE' },
  { match: /chat ?gpt|openai/i, name: 'ChatGPT', hex: '10A37F', letter: 'AI' },
  { match: /canva/i, name: 'Canva', hex: '00C4CC', letter: 'C' },
  { match: /microsoft|office 365|\bxbox\b/i, name: 'Microsoft', hex: '5E5E5E', letter: 'M' },
  { match: /adobe/i, name: 'Adobe', hex: 'DA1F26', letter: 'A' },
  { match: /\bkfc\b/i, icon: siKfc },
  { match: /mcdonald|mcd\b/i, icon: siMcdonalds },
  { match: /burger ?king/i, icon: siBurgerking },
  { match: /starbucks/i, icon: siStarbucks },
  { match: /google drive|google one/i, icon: siGoogledrive },
  { match: /icloud/i, icon: siIcloud },
  { match: /\bapple\b|app store/i, icon: siApple },
  { match: /\bgoogle\b|play store/i, icon: siGoogle },
  { match: /steam/i, icon: siSteam },
  { match: /playstation|\bpsn\b/i, icon: siPlaystation },
  { match: /pubg/i, icon: siPubg },
  { match: /epic games|fortnite/i, icon: siEpicgames },
  { match: /coursera/i, icon: siCoursera },
  { match: /udemy/i, icon: siUdemy },
  { match: /duolingo/i, icon: siDuolingo },
  { match: /notion/i, icon: siNotion },
  { match: /github/i, icon: siGithub },
  { match: /\bzoom\b/i, icon: siZoom },
  { match: /tiktok/i, icon: siTiktok },
  { match: /instagram/i, icon: siInstagram },
  { match: /airbnb/i, icon: siAirbnb },
  { match: /paypal/i, icon: siPaypal },
  { match: /upwork/i, icon: siUpwork },
  { match: /fiverr/i, icon: siFiverr },
];

/**
 * The brand a description names, as { name, hex, path } (a Simple Icons
 * logo) or { name, hex, letter } (a coloured initial), or null.
 */
export function brandFor(text) {
  if (!text) return null;
  const found = BRANDS.find((b) => b.match.test(text));
  if (!found) return null;
  if (found.icon) return { name: found.icon.title, hex: found.icon.hex, path: found.icon.path };
  return found;
}

/**
 * Whether white or near-black reads better on a brand colour.
 *
 * This measured perceived brightness with the old NTSC weighting and a
 * threshold of 160, which is too lenient for saturated greens: Spotify's
 * #1ED760 scores 146, so it took white text - at 1.92:1, effectively
 * invisible. Easypaisa, Careem, SadaPay, Bykea and Zong all sat in the same
 * gap. It now compares the two candidates by real WCAG contrast and takes
 * whichever wins, which is the question actually being asked.
 */
function relativeLuminance(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function inkOn(hex) {
  return contrast('#ffffff', hex) >= contrast('#121214', hex) ? '#ffffff' : '#121214';
}
