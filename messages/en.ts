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

const messages = { ...core, ...home, ...people, ...rent, ...mess, ...complaints, ...gate, ...money, ...mobile };
export default messages;
