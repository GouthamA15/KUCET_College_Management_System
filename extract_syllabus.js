const fs = require('fs');
const path = require('path');

const branches = ['civil', 'csd', 'cse', 'ece', 'eee', 'it', 'mech'];
const baseDir = path.join(process.cwd(), 'src', 'lib', 'syllabus');
const outputFile = path.join(process.cwd(), 'syllabus_summary.txt');

let output = 'KUCET SYLLABUS SUMMARY - ALL BRANCHES\n';
output += '=======================================\n\n';

branches.forEach(branch => {
    output += 'BRANCH: ' + branch.toUpperCase() + '\n';
    output += '-'.repeat(branch.length + 8) + '\n';
    
    const branchDir = path.join(baseDir, branch);
    if (!fs.existsSync(branchDir)) {
        output += 'Directory for ' + branch + ' not found.\n\n';
        return;
    }

    for (let sem = 1; sem <= 8; sem++) {
        const filePath = path.join(branchDir, 'sem' + sem + '.js');
        if (!fs.existsSync(filePath)) {
            continue;
        }

        output += '  SEMESTER ' + sem + ':\n';
        const content = fs.readFileSync(filePath, 'utf8');
        
        const match = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
            try {
                const subjects = eval(match[0]);
                subjects.forEach(sub => {
                    const isLab = (sub.code && (sub.code.endsWith('L') || 
                                   sub.title.toLowerCase().includes('lab') || 
                                   sub.title.toLowerCase().includes('practical') ||
                                   sub.title.toLowerCase().includes('project')));
                    const type = isLab ? '[LAB]' : '[SUB]';
                    
                    if (sub.isGroup && sub.variants && Array.isArray(sub.variants)) {
                        output += '    - ' + sub.code + ': ' + sub.title + ' [ELECTIVE GROUP]\n';
                        sub.variants.forEach(variant => {
                             const vIsLab = (variant.code && (variant.code.endsWith('L') || 
                                   variant.title.toLowerCase().includes('lab') || 
                                   variant.title.toLowerCase().includes('practical')));
                             const vType = vIsLab ? '[LAB]' : '[SUB]';
                             output += '      * ' + variant.code + ': ' + variant.title + ' ' + vType + '\n';
                        });
                    } else {
                        output += '    - ' + sub.code + ': ' + sub.title + ' ' + type + '\n';
                    }
                });
            } catch (e) {
                output += '    Error parsing sem' + sem + '.js for ' + branch + ': ' + e.message + '\n';
            }
        } else {
            output += '    Could not find syllabus array in sem' + sem + '.js\n';
        }
    }
    output += '\n';
});

fs.writeFileSync(outputFile, output);
console.log('Syllabus summary created successfully at syllabus_summary.txt');
