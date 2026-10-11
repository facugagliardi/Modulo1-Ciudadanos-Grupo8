const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const original = content;
            content = content.replace(/personaId/g, 'ciudadanoId');
            content = content.replace(/persona_id/g, 'ciudadano_id');
            content = content.replace(/persona\.id/g, 'ciudadano.id');
            content = content.replace(/persona/g, 'ciudadano');
            content = content.replace(/Persona/g, 'Ciudadano');
            
            // Revert some cases that should not be changed if necessary
            content = content.replace(/Ciudadano Juridica/gi, 'Organizacion');
            
            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Updated ' + fullPath);
            }
        }
    }
}

replaceInDir('./src');
