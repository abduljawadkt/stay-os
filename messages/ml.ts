// Message catalog for "ml". Each screen keeps its strings in its own file under messages/ml/.
import core from "./ml/core.json";
import home from "./ml/home.json";
import people from "./ml/people.json";
import rent from "./ml/rent.json";
import mess from "./ml/mess.json";
import complaints from "./ml/complaints.json";
import gate from "./ml/gate.json";
import money from "./ml/money.json";
import mobile from "./ml/mobile.json";
import whatsapp from "./ml/whatsapp.json";
import ai from "./ml/ai.json";
import tour from "./ml/tour.json";
import account from "./ml/account.json";

const messages = { ...core, ...home, ...people, ...rent, ...mess, ...complaints, ...gate, ...money, ...mobile, ...whatsapp, ...ai, ...tour, ...account };
export default messages;
