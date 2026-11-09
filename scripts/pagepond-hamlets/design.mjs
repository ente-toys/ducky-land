// The approved blueprint coordinates stay intact. These four explicit mappings
// put the houses beside the centre's 350..355-unit small book buildings.
export const sites={
 quillwick:{at:[-1700,-350],k:1.25,plaza:[770,600],bypass:[[[1250,-80],[400,-680],[-1870,-650],[-2040,600],[-1700,1450],[-980,1700]]],links:[{from:[715,0],via:[[-806,-650]]},{from:[0,450],via:[[-2040,213]]},{from:[1536,455],via:[[450,220],[450,1100],[0,1350],[-350,1500]]},{from:[775,1024],via:[[-350,1500],[-980,1700]]}],cap:322,shrink:{'quill-post-hall':['hall-daisy-box']},rest:[0,1,2]},
 inkleaf:{at:[7770,-300],k:1.25,plaza:[775,635],bypass:[[[6500,-150],[7400,-450],[7490,1050],[8500,1280],[9000,2300]]],links:[{from:[0,480],via:[[7490,300]]},{from:[10,1000],via:[[7490,1050]]},{from:[740,1024],via:[[8695,1280],[8500,1280]]},{from:[1450,0],via:[[9300,-550],[7700,-550],[7400,-450]]}],cap:310.5,shrink:{'print-hall':['scroll-basket','paper-ream-west','paper-ream-east']},rest:[3,4]},
 bedtime:{at:[-1650,4400],k:1.25,plaza:[771,645],bypass:[[[ -950,4020],[-1830,4200],[-1980,5410],[-1300,5900],[650,5950]]],links:[{from:[400,1024],via:[[-1300,5900]]},{from:[1130,1024],via:[[200,5900],[650,5950]]},{from:[407,730],via:[[-1550,5400],[-1980,5410]]}],cap:356.5,shrink:{'moon-book-hall':['hall-daisy-pot-west','hall-daisy-pot-east','lectern-hall','books-hall']},rest:[1,4,5]},
 paperboat:{at:[7560,5750],k:1.25,plaza:[770,610],bypass:[[[8500,5500],[7350,5530],[7310,6250],[7000,6550],[6600,6750]]],links:[{from:[318,602],via:[[7310,6250]]},{from:[1120,560],via:[[9250,6200],[9500,5800],[9300,5520],[8500,5500]]}],cap:305.9,shrink:{'paperboat-workshop':['workshop-book-rack','folded-boat-display-rack','workshop-chair','folding-table-main','folding-table-main-paperboat','pot-daisies-west','pot-daisies-front','pot-daisies-tall']},rest:[2,3,4]}
};
// A sitting sleeper replaces the furniture at the same approved resting spot.
// Drawing both would put a second chair/bench inside the approved sleep pose.
export const replacedSeats={inkleaf:['reading-bench-northwest','reading-bench-southeast'],bedtime:['bench-northwest','bench-east','bench-south'],paperboat:['bench-north']};
export const attached={
 quillwick:{'hanging-quill-shop-sign':'ink-and-quill-shop','shop-daisy-box':'ink-and-quill-shop','hall-daisy-box':'quill-post-hall','arbor-lantern-1':'vine-writing-pergola','arbor-lantern-2':'vine-writing-pergola','arbor-lantern-3':'vine-writing-pergola'},
 inkleaf:{'scroll-basket':'print-hall','paper-ream-west':'print-hall','paper-ream-east':'print-hall','pulp-vat':'paper-shelter','deckle-table':'paper-shelter'},
 bedtime:{'hall-daisy-pot-west':'moon-book-hall','hall-daisy-pot-east':'moon-book-hall','books-hall':'moon-book-hall','star-pennant-garland':'lamp-northwest'},
 paperboat:{'workshop-book-rack':'paperboat-workshop','folded-boat-display-rack':'paperboat-workshop','workshop-chair':'paperboat-workshop','folding-table-main':'paperboat-workshop','folding-table-main-paperboat':'paperboat-workshop','pot-daisies-west':'paperboat-workshop','pot-daisies-front':'paperboat-workshop','pot-daisies-tall':'paperboat-workshop','folding-table-quay-paperboat':'folding-table-quay','book-stack-kiosk':'blue-striped-book-kiosk','rope-west':'mooring-post-west','rope-east':'mooring-post-east','jetty-post-west':'south-jetty','jetty-post-east':'south-jetty'}
};
