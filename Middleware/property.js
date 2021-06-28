const PropertyObj = {},
    mongoose = require("mongoose"),
    Property = mongoose.model("Property"),
    Transaction = mongoose.model("TransactionCodes"),
    moment = require("moment"),
    Base64 = require("js-base64").Base64;


PropertyObj.disableFeaturedHouses = () => {
     const dateMonthsAgoFromNow = moment()
          .subtract(3, "days")
          .utc()
          .format();
    Transaction.find({
          createdAt: { $gte: dateMonthsAgoFromNow },
          featured:true,
          status:'completed'
        }).then(trans=>{
            let houses=[]
            trans.map(each=>{
                if(each.houseId){
                    houses.push(each.houseId)
                }else{
                    each.batchHouses.map(item=>{
 houses.push(item)
                    })
                }
            })
            Property.find({featured:true}).then(lll=>{
               // console.log("Featured:",lll.length);
                
            })
            //console.log(houses.length);
            
            trans
            
        })
        .catch(err=>{
            console.log(err)
        })

};


PropertyObj.disableFeaturedHouses();
setInterval(() => {
 // PropertyObj.disableFeaturedHouses();
}, 1000);
module.exports = PropertyObj;
