const fs = require('fs');
const path = require('path');

const teacherCodePath = path.join(__dirname, '..', 'gas', 'Teacher_Code.gs');
const outputPath = path.join(__dirname, '..', 'js', 'gas_code_content.js');

const code = fs.readFileSync(teacherCodePath, 'utf8');

const outputContent = `window.TEACHER_GAS_CODE = {
  "value": ${JSON.stringify(code)},
  toString: function() { return this.value; }
};
window.TEACHER_GAS_CODE_TEXT = ${JSON.stringify(code)};
`;

fs.writeFileSync(outputPath, outputContent, 'utf8');
console.log('Successfully generated js/gas_code_content.js!');
console.log('Output size:', outputContent.length, 'bytes');
