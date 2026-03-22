const fs = require('fs');
const path = 'frontend/src/App.jsx';
let text = fs.readFileSync(path, 'utf8');
const marker = '  const [registrationPhoto, setRegistrationPhoto] = useState(null);';
const additionLines = [
  '',
