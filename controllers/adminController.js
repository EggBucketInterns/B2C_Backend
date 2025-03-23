import { FieldValue, getFirestore } from "firebase-admin/firestore"
import InternalError from "../errors/internalError.js"
import {removeImg} from "../utils/imageRemove.js"
import admin from 'firebase-admin'

const outletCollection = "Outlets"
const deliveryCollection = "Delivery_partner"

const newOutlet = async (req, res) => {
  try{
    const { name, phNo, location , id, outletPartnerId,} = req.body
    if (!req.file) {
      return res
        .status(400)
        .json({ status: "fail", message: "No image file provided" });
    }
    const img=req.file.path || ''

    // Validate the input data
    if (!name || !phNo || !location || !id || !outletPartnerId) {
      await removeImg(req.file.path)
      throw new InternalError("All fields are required")
    }
    
    const db = getFirestore()

    //check if outlet id is unique
    const outletRef = db.collection('Outlets').doc(id);  // Fetch document using customer ID
    const outletDoc = await outletRef.get();

    if (outletDoc.exists) {
      await removeImg(req.file.path)
      return res.status(400).json({ message: 'id must be unique'});
    }

    const address=JSON.parse(location) || {}

    
    await db.collection(outletCollection).doc(id).set({
      id,
      name,
      phNo,
      // location: {
      //   address: location.address,
      //   coordinates: location.coordinates // Store as an object { lat: number, lng: number }
      // },
      address,
      outletPartnerId,
      deleveryPartners:req.body.deleveryPartners || [],
      img
    })
  
    res.status(200).json({ message: "Outlet created successfully",data:req.body })
}
catch (err){
  if(req.file)
  await removeImg(req.file.path)
  res.status(400).json({
    message:"failed to create outlet",
    err
  })
}
}



// Updates an existing outlet
export const updateOutlet = async (req, res) => {
  try {
    const { outletId } = req.params;
    
    // Get data from request body
    const { 
      name, 
      phNo, 
      address, 
      outletPartnerId, 
      deleveryPartners 
    } = req.body;
    
    const db = getFirestore();
    const outletRef = db.collection(outletCollection).doc(outletId);
    const outletDoc = await outletRef.get();
    
    // Check if outlet exists
    if (!outletDoc.exists) {
      return res.status(404).json({ 
        status: "fail", 
        message: "Outlet not found" 
      });
    }
    
    // Prepare update data
    const updateData = {};
    
    // Only update fields that are provided
    if (name) updateData.name = name;
    if (phNo) updateData.phNo = phNo;
    if (outletPartnerId) updateData.outletPartnerId = outletPartnerId;
    
    // Handle nested address update if provided
    if (address) {
      // Parse address if it's a string, otherwise use as is
      const addressData = typeof address === 'string' ? JSON.parse(address) : address;
      updateData.address = addressData;
    }
    
    // Handle delivery partners array update
    if (deleveryPartners) {
      // If array is provided directly use it, otherwise parse it
      const partners = Array.isArray(deleveryPartners) ? 
        deleveryPartners : 
        typeof deleveryPartners === 'string' ? 
          JSON.parse(deleveryPartners) : 
          [];
      
      updateData.deleveryPartners = partners;
    }
    
    // Handle image update if new image is uploaded
    if (req.file) {
      // Get the old image URL to delete later
      const oldImg = outletDoc.data().img;
      updateData.img = req.file.path;
      
      // Remove old image after updating document
      if (oldImg) {
        await removeImg(oldImg);
      }
    }
    
    // Update the document
    await outletRef.update(updateData);
    
    res.status(200).json({ 
      status: "success", 
      message: "Outlet updated successfully",
      data: { id: outletId, ...updateData }
    });
    
  } catch (err) {
    // If there was an error and a file was uploaded, delete it
    if (req.file) {
      await removeImg(req.file.path);
    }
    
    res.status(400).json({
      status: "fail",
      message: "Failed to update outlet",
      error: err.message
    });
  }
};



const createOutletPartner = async (req, res) => {
 
  const { firstName,lastName,aadharNo,password,phone } = req.body
   
  if (!req.file) {
    return res
      .status(400)
      .json({ status: "fail", message: "No image file provided" });
  }
  if(!aadharNo || !password || ! phone) {
    await removeImg(req.file.path)
    return res.status(400).json({
    message:"please enter adharNo, password & phone"
  })
}


const db = getFirestore()

const partnerRef = db.collection('Outlet_partner').doc(phone);  // Fetch document using customer ID
    const partnerDoc = await partnerRef.get();
     
    if (partnerDoc.exists) {
      await removeImg(req.file.path)
      return res.status(400).json({ message: 'phone number allready taken'});
    }

   const img=req.file.path || ''

  
  await db.collection('Outlet_partner').doc(phone).set({
    firstName,lastName,aadharNo,password,phone,img
  })

  res.status(200).json({ message: req.body })
}

const filterOrders = async (startDate, endDate) => {
  const db = getFirestore()
  const ordersCollection = db.collection("Order");

  // Fetch orders in the date range
  const snapshot = await ordersCollection
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .get();

  let totalEarnings = 0;
  let totalOrders = 0;
  let uniqueOutlets = new Set();
  let uniqueCustomers = new Set();

  snapshot.forEach((doc) => {
      const order = doc.data();
      totalEarnings += order.amount || 0;
      totalOrders += 1;
      uniqueOutlets.add(order.outletId);
      uniqueCustomers.add(order.customerId);
  });

  return {
      totalEarnings,
      totalOrders,
      uniqueOutlets: [...uniqueOutlets], // Convert Set to Array
      uniqueCustomers: [...uniqueCustomers],
  };
};

const fetchCounts = async (outletIds, customerIds) => {
  const outletCount = outletIds.length;
  const customerCount = customerIds.length;

  return { totalOutlets: outletCount, totalCustomers: customerCount };
};

const deleteOutletPartner = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ message: "Outlet partner ID is required." });
    }

    const db = getFirestore();
    const userRef = db.collection('Outlet_partner').doc(id);
    const driverDoc = await userRef.get();

    if (!driverDoc.exists) {
      return res.status(404).json({ message: "Partner not found." });
    }

    const img = driverDoc.data()?.img;
    if (img) {
      await removeImg(img);
    }

    await userRef.delete();
    
    res.status(200).json({ message: `Partner with ID ${id} deleted successfully.` });
  } catch (error) {
    console.error('Error deleting Partner:', error);
    res.status(500).json({ message: 'Error deleting partner', error: error.message });
  }
};



const newDeliveryPartner = async (req, res) => {
  let { phone, timeOfCreation, outlets } = req.body
  timeOfCreation=timeOfCreation || Date.now()
  const db = getFirestore()
  await db.collection(deliveryCollection).doc(phone).set({
    phone,
    timeOfCreation,
    outlets //Array of items which identify each outlet(Doc id in firebase)
  })

  res.status(200).json({ message: "User created" })
}

const unlinkPartner = async (req, res) => {
  const { phone, outlet } = req.body

  const db = getFirestore()
  var resp = await db
    .collection(deliveryCollection)
    .doc(phone)
    .update({
      outlets: FieldValue.arrayRemove(outlet)
    })
  if (!resp) {
    throw new InternalError("Internal server error")
  }
  resp = await db
    .collection(outletCollection)
    .doc(outlet)
    .collection("FCM_tokens")
    .doc("Tokens")
    .update({
      phone: FieldValue.delete()
    })
  if (!resp) {
    throw new InternalError("Internal server error")
  }
  res.status(200).json({ message: "Partner unlinked from outlet" })
}

const linkPartner = async (req, res) => {
  const { phone, outlet } = req.body

  const db = getFirestore()
  var resp = await db
    .collection(deliveryCollection)
    .doc(phone)
    .update({
      outlets: FieldValue.arrayUnion(outlet)
    })
  if (!resp) {
    throw new InternalError("Internal server error")
  }
  res.status(200).json({ message: "Outlet added" })
  //Whenever token is updated next time , Partener will then receive notfications from particular outletß
}

const customerInsights = async (req, res) => {
  try {
    const db = getFirestore();

    const customersSnapshot = await db.collection('Customer').orderBy('totalOrders', 'desc').get();
    const totalCustomers = customersSnapshot.size;

    const ageGroup = [0, 0, 0, 0, 0, 0]; 
    let inactiveCust = 0, newCust = 0, returningCust = 0, male = 0, female = 0, others = 0;

    const customers = customersSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Handle missing or undefined fields
      const age = parseInt(data.age, 10) || 0;
      if (age > 0) {
        if (age <= 25) ageGroup[0]++;
        else if (age <= 35) ageGroup[1]++;
        else if (age <= 45) ageGroup[2]++;
        else if (age <= 60) ageGroup[3]++;
        else if (age <= 100) ageGroup[4]++;
        else ageGroup[5]++;
      }
      
      const totalOrders = data.totalOrders || 0;
      if (totalOrders === 0) inactiveCust++;
      else if (totalOrders === 1) newCust++;
      else returningCust++;
      
      const gender = data.gender ? data.gender.toLowerCase() : '';
      if (gender === 'male') male++;
      else if (gender === 'female') female++;
      else others++;

      return {
        name: data.name || 'Unknown',
        phone: data.phone || 'N/A',
        totalOrders,
        totalExpenditure: data.totalExpenditure || 0
      };
    });

    for (let k = 0; k < 6; k++) ageGroup[k] = (ageGroup[k] * 100.0) / totalCustomers;
    male = (male * 100.0) / totalCustomers;
    female = (female * 100.0) / totalCustomers;
    others = (others * 100.0) / totalCustomers;
    inactiveCust = (inactiveCust * 100.0) / totalCustomers;
    newCust = (newCust * 100.0) / totalCustomers;
    returningCust = (returningCust * 100.0) / totalCustomers;

    const ordersSnapshot = await db.collection('Order').get();
    const orders = ordersSnapshot.docs.map(doc => doc.data());

    const areaCounts = {};
    orders.forEach(order => {
      const area = order.address?.area || 'Unknown';
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    });

    const totalOrders = orders.length;
    let areaArray = Object.entries(areaCounts).map(([area, count]) => [area, (count * 100.0) / totalOrders]);
    areaArray.sort((a, b) => b[1] - a[1]);

    res.status(200).json({
      customers,
      aggregation: {
        areaArray,
        ageGroup: {
          '<25': ageGroup[0], '<35': ageGroup[1], '<45': ageGroup[2], '<60': ageGroup[3], '60+': ageGroup[4], 'oth': ageGroup[5]
        },
        totalCustomers,
        inactiveCust,
        custEnquiry: 0,
        newCust,
        returningCust,
        male,
        female,
        others
      }
    });
  } catch (error) {
    console.error('Error getting customer insights:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


const deliveryInsights = async (req,res)=>{
  try {
    const db = getFirestore();

    const driversCollection = db.collection('Delivery_partner'); // Replace with your collection name
    const snapshot = await driversCollection.get();
    const totalDrivers=snapshot.size
    let totalDeliveries=0
    
    if (snapshot.empty) {
      return res.status(404).json({ message: 'No delivery drivers found' });
    }

    const drivers = [];
    snapshot.forEach(doc => {
      totalDeliveries+=doc.data().totalDeliveries
      drivers.push(
        { 
          id: doc.id,
          name:doc.data().generalDetails?.firstName ||doc.data().firstName,
          password: doc.data().password,
          ratings: doc.data().ratings,
          totalDeliveries: doc.data().totalDeliveries,
          approved:doc.data().submissionStatus || doc.data().approved,
          region:doc.data().generalDetails?.address?.fullAddress?.city || ""
         });
    });

    return res.status(200).json({totalDeliveries,totalDrivers,drivers});
  } catch (error) {
    console.error('Error fetching delivery drivers:', error);
    return res.status(500).json({ message: 'Error fetching delivery drivers', error });
  }
}


// Handler function to fetch outlets, orders, and partners
const getAllOutletsWithOrderAndPartners = async (req, res) => {
  try {
    const db = getFirestore();

    // Fetch all outlets from the Outlet collection
    const outlets = await db.collection('Outlets').get();
    const totalOutlets = outlets.size;

    const outletData = outlets.docs.map(doc => {
      const data = doc.data(); // Get all data from the document
      const address = data.address || {}; // Safe access to address
      const coordinates = address.coordinates || {}; // Safe access to coordinates
      const fullAddress = address.fullAddress || {}; // safe access to fullAddress

      return {
        id: doc.id,
        name: data.name,
        area: fullAddress.area || null, // Handle missing area
        outletPartnerId: data.outletPartnerId,
        contact: data.phNo,
        lat: coordinates.lat || null, // Handle missing lat
        long: coordinates.long || null, // Handle missing long
        ...data, // Include all other data
      };
    });

    // Fetch total number of orders from the Order collection
    const orders = await db.collection('Order').get();
    const totalOrders = orders.size;

    let revenue = 0;
    orders.docs.forEach(doc => {
      const orderData = doc.data();
      revenue += orderData.amount || 0; // Handle missing amount
    });

    // Fetch all outlet partners from the Delivery_partner collection
    const partners = await db.collection('Delivery_partner').get();
    const totalPartners = partners.size;

    // Create the response object with all the data
    const response = {
      revenue,
      totalOrders,
      totalOutlets,
      totalPartners,
      outlets: outletData,
    };

    // Send the combined response
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching data:', error.message);
    return res.status(500).json({ error: 'Failed to fetch data', details: error.message }); //add details to error.
  }
};


const getOneOutlet = async (req, res) => {
  try {
    const db = getFirestore();
    const id = req.params.id;

    // Fetch outlet details by id
    const outletDoc = db.collection('Outlets').doc(id);  
    const outletSnapshot = await outletDoc.get();

    if (!outletSnapshot.exists) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    const outletData = outletSnapshot.data();

    // Fetch orders for the outlet and calculate revenue
    let revenue = 0;
    let totalOrders = 0;

    const ordersQuery = await db.collection('Order').where("outletId", "==", id).get();

    ordersQuery.docs.forEach(doc => {
      revenue += doc.data().amount || 0; // Sum up the order amounts
      totalOrders++; // Count total orders
    });

    // Fetch outlet partner (assuming the partner's document ID is stored in the outlet)
    const partnerId = outletData.outletPartnerId; // Assuming `outletPartnerId` is stored in outlet data
    const partnersDoc = db.collection('Outlet_partner').doc(partnerId);  
    const partnerSnapshot = await partnersDoc.get();

    let outletPartnerData = {};
    if (partnerSnapshot.exists) {
      outletPartnerData = partnerSnapshot.data();
    }

    // Fetch delivery partner details based on delivery partner IDs
    const deliveryPartnerIds = outletData.deleveryPartners || [];
    const deliveryPartnerDetails = [];

    for (const partnerId of deliveryPartnerIds) {
      const deliveryPartnerDoc = db.collection('Delivery_partner').doc(partnerId);
      const deliveryPartnerSnapshot = await deliveryPartnerDoc.get();

      if (deliveryPartnerSnapshot.exists) {
        deliveryPartnerDetails.push(deliveryPartnerSnapshot.data());
      }
    }

    // Create the response object with all the data
    const response = {
      revenue,
      totalOrders,
      totalDeleveryPartners: deliveryPartnerIds.length,
      outlet: outletData,
      outletPartner: outletPartnerData,
      deliveryPartners: deliveryPartnerDetails // Adding delivery partners details to the response
    };

    // Send the combined response
    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching data:', error.message);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
};

const approveDelivery = async (req, res) => {
  try {
    const deliveryPartnerId = req.params.id;

    // Firestore initialized
    const db = getFirestore();
    const deliveryDocRef = db.collection("Delivery_partner").doc(deliveryPartnerId);

    // Get the document snapshot
    const deliveryDoc = await deliveryDocRef.get();
    if (!deliveryDoc.exists) {
      return res.status(404).json({ message: "Delivery partner not found" });
    }

    const deliveryData = deliveryDoc.data();

    // Check if submissionStatus exists
    let submissionStatus = deliveryData.submissionStatus;

    if (submissionStatus) {
      // If submissionStatus exists, make only the present fields true
      Object.keys(submissionStatus).forEach((key) => {
        submissionStatus[key] = true;
      });
      await deliveryDocRef.update({submissionStatus});
    } else {
      await deliveryDocRef.update({approved:true})
    }
    return res.status(200).json({ message: "Delivery partner approved" });
  } catch (error) {
    console.error("Error approving delivery partner:", error.message);
    return res.status(500).json({ error: "Failed to approve delivery partner" });
  }
};


const getProductCount =async(req,res)=>{
  try {
    const db = getFirestore();
    const productDocRef = db.collection("products")
    const snapshot = await productDocRef.get()
    
    if(productDocRef.exists) return res.status(404).json({message:"No product found."})
      
    const product =[]
    //ittrate the colloction docs and add the documnet information to the product
    snapshot.forEach(doc=>{
      const data = doc.data()
      product.push({name:data.name,count:data.count})
    })
    
    res.status(200).json({
      status:"Success",
      product
    })

  } catch (error) {
    console.error('Error fetching data:', error.message);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}

const changeProductprice = async (req, res) => {
  try {
    const { id } = req.params; // Destructure id from params
    let { rate, discount , countInStock} = req.body; // Destructure rate and discount from body


    // Check if rate and discount are valid
    if (rate === undefined || discount === undefined) {
      return res.status(400).json({ message: "Rate and discount are required." });
    }

    // Get Firestore instance
    const db = getFirestore();
    const productDocRef = db.collection("products").doc(id);

    // Check if the product exists
    const productDoc = await productDocRef.get();
    if (!productDoc.exists) {
      return res.status(404).json({ message: "Product not found" });
    }

    const data = productDoc.data()


    // Update product data and check if value for field is given or not
    await productDocRef.update({
      rate :rate?rate:data.rate,
      discount: discount?discount:data.discount,
      countInStock : countInStock ? countInStock : data.countInStock,
    });

    return res.status(200).json({ message: "Product price updated successfully." });
  } catch (error) {
    console.error("Error updating product price:", error.message);
    return res.status(500).json({ error: "Failed to update product price." });
  }
};

const getAllProducts = async (req, res) => {
  try {
    // Get Firestore instance
    const db = getFirestore();

    // Reference the "products" collection
    const productsCollection = db.collection("products");

    // Fetch all documents in the collection
    const snapshot = await productsCollection.get();

    // Check if the collection is empty
    if (snapshot.empty) {
      return res.status(404).json({ message: "No products found." });
    }

    // Map through the documents and return an array of product data
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      currentPrice:doc.data().rate,
      price: doc.data().rate - (doc.data().rate*(doc.data().discount/100)),
      name:doc.data().name,
      countInStock:doc.data().countInStock,
      discount:doc.data().discount,
    }));

    return res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error.message);
    return res.status(500).json({ error: "Failed to fetch products." });
  }
};

const getOutletPartners = async (req, res) => {
  try {
    // Get Firestore instance
    const db = getFirestore();

    // Reference the "products" collection
    const productsCollection = db.collection("Outlet_partner");

    // Fetch all documents in the collection
    const snapshot = await productsCollection.get();

    // Check if the collection is empty
    if (snapshot.empty) {
      return res.status(404).json({ message: "No outlet partners found." });
    }

    // Map through the documents and return an array of product data
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      name : doc.data().firstName || ''  + doc.data().lastName || "",
      data:doc.data()
    }));

    return res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error.message);
    return res.status(500).json({ error: "Failed to fetch outlet partners." });
  }
};

const getApprovedDP = async(req,res)=>{
  try {
    
    //  Firestore 
    const db = getFirestore();
    const approvedDP = db.collection("Delivery_partner").get();
  

  } catch (error) {
    console.error("Error fetching products:", error.message);
    return res.status(500).json({ error: "Failed to fetch delivery partners." });
  }
}
const getDeliveryPartner = async(req,res)=>{
  try {
    const id = req.params.id

    if(!id){
      return res.status(500).json({message:"Delivery partner id needed"})
    }
    //  Firestore 
    const db = getFirestore();
    const delivaryParnerRef = db.collection("Delivery_partner").doc(id);
    const deliveryPartnerDoc = await delivaryParnerRef.get()
    
    if (!deliveryPartnerDoc.exists) {
      return res.status(500).json({message:"Delivery partner not found"})
    }

    return res.status(200).json(deliveryPartnerDoc.data())
  } catch (error) {
    console.error("Error fetching products:", error.message);
    return res.status(500).json({ error: "Failed to fetch delivery partners." });
  }
}

const createDP = async (req, res) => {
  try {
    //extract the detailse
    
    let {
      firstName,
      phone,
      password,
    } = req.body;

    const db = getFirestore();
    if (!phone || !password) {
      return res.status(400).json({
        message: "All info required"
      });
    }


    const image = req.file ? req.file.path : null;

    // const password = `${phone}@${firstName}`

    //general details of dilivery partner
    const generalDetails = {
      password,
      firstName,
      phone,
      image,
    };

    //rating inforamation
    const ratingInfo = {
      rating:0,
      newCount:0,
      customers:[],
    }

    // Firestore reference
    const userRef = db.collection("Delivery_partner").doc(phone);
    const userDoc = await userRef.get()
    //check if user already exists
    if (userDoc.exists) {
      return res.status(400).json({message: "Delivery partner already exists"})
    }

    await userRef.set(
      {
        generalDetails:generalDetails,
        approved:true,
        ratingInfo,
        ratings:0,
        totalDeliveries: 0
      },
      { merge: true } // Merge with existing data
    )
    res.status(200).json({ status: "success", message: "Delivery partner created!.",password});
  } catch (error) {
    console.error("Error creating/updating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const deleteDP = async(req,res)=>{
  try {
    const id = req.params.id

    if (!id) {
      return res.status(500).json({message:"Delivery partner id nedded!."})
    }

    const db = getFirestore()
    const deliveryRef = db.collection("Delivery_partner").doc(id)
    const deliveryDoc = await deliveryRef.get()

    if (!deliveryDoc.exists) {
      return res.status(500).json({message:"Delivery partner not found!."})
    }

    await deliveryRef.delete()
    return res.status(200).json({message:"Delivery partner removed succefully!"})
  } catch (error) {
    console.log(error);
    return res.status(500).json({message:"Internal Server error"})
  }
}
const deleteOutlet = async(req,res)=>{
  try {
    const id = req.params.id

    if (!id) {
      return res.status(500).json({message:"Outlet id nedded!."})
    }

    const db = getFirestore()
    const outletRef = db.collection("Outlets").doc(id)
    const outletDoc = await outletRef.get()

    if (!outletDoc.exists) {
      return res.status(500).json({message:"outlet not found!."})
    }

    await outletRef.delete()
    return res.status(200).json({message:"Outlet removed succefully!"})
  } catch (error) {
    console.log(error);
    return res.status(500).json({message:"Internal Server error"})
  }
}

const deleteOrder = async(req,res)=>{
  try {
    const id = req.params.id

    if (!id) {
      return res.status(500).json({message:"Order id nedded!."})
    }
    const db = getFirestore()
    const orderRef = db.collection("Order").doc(id)
    const orderDoc = await orderRef.get()

    if (!orderDoc.exists) {
      return res.status(500).json({message:"Order not found!."})
    }
    await orderRef.delete()
    return res.status(200).json({message:"Order removed succefully!"})
  } catch (error) {
    console.log(error);
    return res.status(500).json({message:"Internal Server error"})
  }
}

const filteringOrders = async (req, res) => {
  try {
      let { filter } = req.query;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let results = [];

      if (filter === "month") {
          // Fetch previous 10 months
          for (let i = 9; i >= 0; i--) {
              const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
              const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59);

              const orderData = await filterOrders(
                  admin.firestore.Timestamp.fromDate(start),
                  admin.firestore.Timestamp.fromDate(end)
              );

              const counts = await fetchCounts(orderData.uniqueOutlets, orderData.uniqueCustomers);

              results.push({
                  month: start.toLocaleString("en-US", { month: "short" }), // e.g., "Jan", "Feb"
                  totalEarnings: orderData.totalEarnings,
                  totalOrders: orderData.totalOrders,
                  totalOutlets: counts.totalOutlets,
                  totalCustomers: counts.totalCustomers,
              });
          }
      } else if (filter === "year") {
          // Fetch previous 10 years
          for (let i = 9; i >= 0; i--) {
              const year = today.getFullYear() - i;
              const start = new Date(year, 0, 1);
              const end = new Date(year, 11, 31, 23, 59, 59);

              const orderData = await filterOrders(
                  admin.firestore.Timestamp.fromDate(start),
                  admin.firestore.Timestamp.fromDate(end)
              );

              const counts = await fetchCounts(orderData.uniqueOutlets, orderData.uniqueCustomers);

              results.push({
                  year: year,
                  totalEarnings: orderData.totalEarnings,
                  totalOrders: orderData.totalOrders,
                  totalOutlets: counts.totalOutlets,
                  totalCustomers: counts.totalCustomers,
              });
          }
      } else if (filter === "week") {
          // Fetch previous 10 days including today
          for (let i = 9; i >= 0; i--) {
              const start = new Date(today);
              start.setDate(today.getDate() - i);
              start.setHours(0, 0, 0, 0);

              const end = new Date(start);
              end.setHours(23, 59, 59, 999);

              const orderData = await filterOrders(
                  admin.firestore.Timestamp.fromDate(start),
                  admin.firestore.Timestamp.fromDate(end)
              );

              const counts = await fetchCounts(orderData.uniqueOutlets, orderData.uniqueCustomers);

              results.push({
                  day: start.toLocaleString("en-US", { weekday: "short" }), // e.g., "Tue", "Mon"
                  totalEarnings: orderData.totalEarnings,
                  totalOrders: orderData.totalOrders,
                  totalOutlets: counts.totalOutlets,
                  totalCustomers: counts.totalCustomers,
              });
          }
      } else {
          return res.status(400).json({ error: "Invalid filter type" });
      }

      res.status(200).json({ data: results });
  } catch (error) {
      console.error("Error fetching summary:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllCountInformation = async (req, res) => {
  try {
    const db = getFirestore();

    const information = {
      totalOutlets: 0,
      totalCustomers: 0,
      totalEarning: 0,
      totalOrders: 0,
      totalOutletPartners:0,
    };

    // Get orders collection
    const ordersSnapshot = await db.collection("Order").get();
    information.totalOrders = ordersSnapshot.size;

    ordersSnapshot.forEach((doc) => {
      information.totalEarning += doc.data().amount || 0;
    });

    // Get unique outlets
    const outletsSnapshot = await db.collection("Outlets").get();
    information.totalOutlets = outletsSnapshot.size;

    // Get unique customers
    const customersSnapshot = await db.collection("Customer").get();
    information.totalCustomers = customersSnapshot.size;

    const outletPartners = await db.collection("Outlet_partner").get();
    information.totalOutletPartners = outletPartners.size;

    return res.status(200).json({ data: information });
  } catch (error) {
    console.error("Error fetching count information:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


const updateOutletPartner = async (req, res) => {
  try {
    const { userId } = req.params; // Get ID from request params
    const updateData = req.body; // Other form fields
    const db = getFirestore();

    if (!userId) {
      return res.status(400).json({ message: "Outlet partner ID is required." });
    }

    const userRef = db.collection("Outlet_partner").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "Outlet partner not found." });
    }

    let img = userDoc.data()?.img; // Default to old image

    // Check if a new image was uploaded
    if (req.file) {
      await removeImg(img); // Remove old image from storage
      img = req.file.path; 
    }

    // Update Firestore document with new data (including new image URL)
    await userRef.update({
      ...updateData,
      img: img, // Update image URL if changed
    });
    res.status(200).json({ message: `Partner with ID ${userId} updated successfully.` });
  } catch (error) {
    console.error("Error updating partner:", error);
    res.status(500).json({ message: "Error updating partner", error: error.message });
  }
};

const addDeliveryPartnerToOutlet = async (req, res) => {
  try {
    const { outletId } = req.params;
    const { delPartners = [], remPartners = [] } = req.body; 
    const db = getFirestore();

    if (!outletId) {
      return res.status(400).json({ message: "Outlet ID is required." });
    }

    const userRef = db.collection("Outlets").doc(outletId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "Outlet not found." });
    }

    const data = userDoc.data();
    const deliveryPartners = data.deleveryPartners || [];

    // Remove the partners from the list
    const afterRemoval = deliveryPartners.filter(partner => !remPartners.includes(partner));

    // Add new delivery partners without duplicates
    const updatedPartners = Array.from(new Set([...afterRemoval, ...delPartners]));

    // Update Firestore document
    await userRef.update({
      deleveryPartners: updatedPartners,
    });

    res.status(200).json({ message: "Delivery partners updated successfully." });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};




export { 
  newOutlet,
  createOutletPartner,
  deleteOutletPartner, 
  newDeliveryPartner, 
  unlinkPartner, 
  linkPartner ,
  customerInsights,
  deliveryInsights,
  getAllOutletsWithOrderAndPartners,
  getOneOutlet,
  approveDelivery,
  getProductCount,
  changeProductprice,
  getAllProducts,
  getOutletPartners,
  getApprovedDP,
  getDeliveryPartner,
  createDP,
  deleteDP,
  deleteOutlet,
  deleteOrder,
  filteringOrders,
  getAllCountInformation,
  updateOutletPartner,
  addDeliveryPartnerToOutlet,
}
