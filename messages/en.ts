// Message catalog for "en". Each screen keeps its strings in its own file under messages/en/.
import core from "./en/core.json";
import home from "./en/home.json";
import people from "./en/people.json";
import rent from "./en/rent.json";
import mess from "./en/mess.json";
import complaints from "./en/complaints.json";
import gate from "./en/gate.json";
import money from "./en/money.json";
import mobile from "./en/mobile.json";
import whatsapp from "./en/whatsapp.json";
import ai from "./en/ai.json";
import tour from "./en/tour.json";
import account from "./en/account.json";

const messages = { ...core, ...home, ...people, ...rent, ...mess, ...complaints, ...gate, ...money, ...mobile, ...whatsapp, ...ai, ...tour, ...account };
export default messages;
