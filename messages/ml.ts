// Message catalog for "ml". Each screen keeps its strings in its own file under messages/ml/.
import core from "./ml/core.json";
import home from "./ml/home.json";
import people from "./ml/people.json";
import rent from "./ml/rent.json";
import mess from "./ml/mess.json";
import complaints from "./ml/complaints.json";
import gate from "./ml/gate.json";
import money from "./ml/money.json";

const messages = { ...core, ...home, ...people, ...rent, ...mess, ...complaints, ...gate, ...money };
export default messages;
