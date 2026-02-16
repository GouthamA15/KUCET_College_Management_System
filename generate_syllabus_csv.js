const fs = require('fs');
const path = require('path');

const branches = ['civil', 'csd', 'cse', 'ece', 'eee', 'it', 'mech'];
const baseDir = path.join(process.cwd(), 'src', 'lib', 'syllabus');
const outputFile = path.join(process.cwd(), 'syllabus_faculty_allocation_v3.csv');

// CSV Header - One row per subject/lab as all units are taught by a single faculty
let csvContent = 'Branch,Semester,Subject Code,Subject Title,Type,Faculty Name(s)\n';

function escapeCsv(str) {
    if (!str) return '""';
    const clean = str.replace(/"/g, '""');
    return `"${clean}"`;
}

branches.forEach(branch => {
    const branchDir = path.join(baseDir, branch);
    if (!fs.existsSync(branchDir)) return;

    for (let sem = 1; sem <= 8; sem++) {
        const filePath = path.join(branchDir, 'sem' + sem + '.js');
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const match = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        
        if (match) {
            try {
                const subjects = eval(match[0]);
                
                subjects.forEach(sub => {
                    const processSubject = (item, parentGroup = null) => {
                        if (item.isGroup && item.variants) {
                            item.variants.forEach(v => processSubject(v, item.title));
                            return;
                        }

                        const code = item.code || 'N/A';
                        const title = item.title || 'N/A';
                        const isLab = (code && (code.endsWith('L') || 
                                       title.toLowerCase().includes('lab') || 
                                       title.toLowerCase().includes('practical') ||
                                       title.toLowerCase().includes('project')));
                        const type = isLab ? 'LAB' : 'THEORY';
                        
                        // Single row for the whole subject/lab
                        const row = [
                            branch.toUpperCase(),
                            'Sem ' + sem,
                            escapeCsv(code),
                            escapeCsv(title + (parentGroup ? ' (' + parentGroup + ')' : '')),
                            type,
                            '""' // Faculty placeholder
                        ].join(',');
                        csvContent += row + '\n';
                    };

                    processSubject(sub);
                });
            } catch (e) {
                console.error('Error processing ' + branch + ' sem ' + sem + ': ' + e.message);
            }
        }
    }
});

fs.writeFileSync(outputFile, csvContent);
console.log('Successfully generated ' + outputFile);
