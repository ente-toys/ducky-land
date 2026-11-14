// Image decoding happens in a worker; transferred bitmaps retain no CPU copy here.
self.onmessage = async ({data:{id,blob,options}}) => {
  try {
    const bitmap=await createImageBitmap(blob,options);
    self.postMessage({id,bitmap},[bitmap]);
  } catch(error) {self.postMessage({id,error:error.message});}
};
