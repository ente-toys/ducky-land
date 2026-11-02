const fs=require('fs'),sharp=require('/Users/pragadees.xd/Developer/ente-merch/node_modules/sharp');
fs.mkdirSync('reference',{recursive:true});
Promise.all([
 sharp('../drip-ref/svg/ducky_base-CyE3RFV7.svg').png().toFile('drip-reference.png'),
 sharp('../drip-ref/svg/ducky_base-CyE3RFV7.svg',{density:288}).png().toFile('reference/drip-source-4x.png'),
 sharp('reference/drip-ducky-flat.svg').png().toFile('reference/drip-ducky-flat.png'),
 sharp('pipeline-five/expected.svg').png().toFile('pipeline-five/expected.png'),
]).catch(e=>{console.error(e);process.exit(1)});
