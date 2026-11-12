import {IDENTITIES} from './round2-buildings.mjs';
export const BUILDING_STYLES={
 'bellpeep-foundry':{roof:'hip',work:'bell',chimney:'left',roofColor:'#be6c45',wall:'#fae7b9',loft:'round'},
 'bellpeep-house-west':{roof:'gable',chimney:'right',loft:'bell',windows:'pair',roofColor:'#cd7950',wall:'#fff0cd'},
 'bellpeep-house-east':{roof:'hip',chimney:'left',loft:'dormer',windows:'arch',roofColor:'#b76543',wall:'#f6e2b0'},
 'bellpeep-house-south':{roof:'bonnet',loft:'round',windows:'pair',canopy:true,roofColor:'#d48a59',wall:'#f9e8c5'},
 'olivello-house-west':{roof:'hip',chimney:'right',windows:'arch',loft:'dormer',roofColor:'#c47a4c',wall:'#fae5b8',vine:true},
 'olivello-house-east':{roof:'gable',loft:'olive',windows:'pair',roofColor:'#b96b43',wall:'#fff0cd',vine:true},
 'olivello-house-southwest':{roof:'bonnet',chimney:'left',windows:'wide',loft:'round',roofColor:'#ce895b',wall:'#f5dfae'},
 'olivello-olive-workshop':{roof:'hip',work:'olive',chimney:'right',roofColor:'#b96b43',wall:'#f9e6bb',loft:'olive'},
 'tessera-house-northwest':{roof:'gable',chimney:'left',windows:'arch',loft:'diamond',roofColor:'#c16d49',wall:'#fff0cd',tile:true},
 'tessera-house-southwest':{roof:'bonnet',loft:'dormer',windows:'pair',roofColor:'#d3895e',wall:'#f8e4ba',tile:true},
 'tessera-house-southeast':{roof:'hip',chimney:'right',loft:'round',windows:'wide',canopy:true,roofColor:'#b96747',wall:'#f7e8ca',tile:true},
 'tessera-mosaic-workshop':{roof:'gable',work:'tile',chimney:'left',roofColor:'#cb7b50',wall:'#ffedc6',loft:'diamond'},
 'crumbbell-house-west':{roof:'bonnet',chimney:'right',windows:'arch',loft:'round',roofColor:'#c97e50',wall:'#fce9be',harbour:true},
 'crumbbell-house-east':{roof:'gable',chimney:'left',windows:'pair',loft:'shell',roofColor:'#b96843',wall:'#fff0cb',harbour:true},
 'crumbbell-house-south':{roof:'hip',loft:'dormer',windows:'wide',canopy:true,roofColor:'#d18a5a',wall:'#f7e0b3',harbour:true},
 'crumbbell-bakery':{roof:'bonnet',work:'bread',chimney:'left',roofColor:'#bd7049',wall:'#ffecc2',loft:'shell',harbour:true},
};

for(const [village,identity] of Object.entries(IDENTITIES)){
 const entries=Object.entries(BUILDING_STYLES).filter(([id])=>id.startsWith(village+'-'));
 entries.forEach(([id,s],i)=>Object.assign(s,{village,identity,roof:identity.roofs[i],porchWidth:[108,124,142,118][i],signSide:i%2?'left':'right',signDrop:[0,11,5,17][i],signShape:['board','pennant','diamond','board'][i]}));
}
