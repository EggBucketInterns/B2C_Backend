import { getFirestore } from "firebase-admin/firestore";
import { sendNotification } from "./outletController.js";

const mainCollection = "Order";

// Haversine formula to calculate distance between two coordinates
function haversineDistance(coords1, coords2) {
  const toRad = (value) => (value * Math.PI) / 180;

  const lat1 = coords1.lat;
  const lon1 = coords1.long;
  const lat2 = coords2.lat;
  const lon2 = coords2.long;

  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}


const newOrder = async (req, res) => {
  const {
    address, // Contains address and coordinates
    amount, // Total amount of the order
    products, // Object containing quantities of products
    // outletId, 
    customerId, // ID of the customer
  } = req.body;
  
  if(!address || !address.coordinates || !amount || !products || !customerId)
     return res.status(400).json({status:"fail",message:"please enter all details of order with lat,long in address"})
  
  const db = getFirestore();

 // check for nearest outlet
    const orderCoordinates = { lat: parseFloat(address.coordinates.lat), long: parseFloat(address.coordinates.long)}; // Input coordinates
    let maxDistance = 5; // Maximum distance in kilometers
    let distance=5
    const outletsRef = db.collection('Outlets');
    const snapshot = await outletsRef.get();
    
    let nearbyOutlet ={};

    snapshot.forEach(doc => {
      const outletData = doc.data();
      const outletCoords = outletData.address.coordinates;
      
      distance = haversineDistance(orderCoordinates, {
        lat: parseFloat(outletCoords.lat),
        long: parseFloat(outletCoords.long)
      });
      
      if (distance < maxDistance) {
        maxDistance=distance
        nearbyOutlet={
          id:outletData.id || 'NA',
          name:outletData.name || 'NA',
          phNo:outletData.phNo || 'NA',
          img:outletData.img || 'NA',
          distance:distance.toFixed(2) + 'KM'
        };
      }
    });

    if (Object.keys(nearbyOutlet).length==0) {
      return res.status(404).json({status:"fail",message:'No nearby outlets, we will soon expand here!!'});
    }


 // creatig order for nearest outlet
  const outletId=nearbyOutlet.id
  const deleveryDistance=distance.toFixed(6) + "KM"
  const createdAt=Date.now();
  const updatedAt=createdAt
  const status="Pending";
  const orderAcceptedByRider = false

  //to assign the increasing count to the product 
  const countRef = await db.collection(mainCollection).get();
  const count = countRef.size;
  
  // Generate a unique ID for the order
  const id = `${customerId}-${createdAt}-${count+1}`;

  try {
    // 1. Create the new order in Firestorep
    const orderData={
      address, // Address and coordinates
      amount, // Total amount of the order
      products, // Object with product quantities (E6, E12, E30)
      createdAt: new Date(createdAt), // Timestamp for order creation
      updatedAt: new Date(updatedAt), // Timestamp for order update
      outletId, // ID of the outlet
      customerId, // ID of the customer
      deleveryDistance,
      status,
      orderAcceptedByRider
    }
    await db.collection(mainCollection).doc(id).set(orderData);
    

    // 2. Fetch the customer by customerId
    const customerRef = db.collection("Customer").doc(customerId); // Fetch customer document using customer ID
    const customerDoc = await customerRef.get();

    // 3. Check if the customer exists
    if (customerDoc.exists) {
      // 4. If customer exists, increment their totalExpenditure by the order amount
      const customerData = customerDoc.data();
      const currentExpenditure = customerData.totalExpenditure || 0; // If totalExpenditure doesn't exist, default to 0
      const currentOrders=customerData.totalOrders || 0;

      await customerRef.update({
        totalExpenditure: currentExpenditure + amount,
        totalOrders:currentOrders+1
      });



      // 5. Changing total sale in Outlate 
      const outletRef = db.collection("Outlets").doc(outletId); // Fetch outlet document using outletId
      const outletDoc = await outletRef.get(); // Get the document snapshot
      const outletData = outletDoc.data(); // Get the document data

      if (outletDoc.exists) {      
        // Check if totalSales exists and has properties, if not, initialize them
        const totalSales = outletData.totalSales || { E6: 0, E12: 0, E30: 0 };
      
        await outletRef.update({
          totalSales: {
            E6: (totalSales.E6 || 0) + (products.E6 || 0),
            E12: (totalSales.E12 || 0) + (products.E12 || 0),
            E30: (totalSales.E30 || 0) + (products.E30 || 0),
          }
        });
      }
      //notification

      // sendNotification(outletData,address,outletData.id);

      //Total order of product
        const productCounts = {
          "6pc_tray": "E6",
          "12pc_tray": "E12",
          "30pc_tray": "E30",
        };
        const productRef = db.collection("products");
        const productsDoc = await productRef.get();

        productsDoc.forEach(async (doc) => {
          const data = doc.data();
          const productKey = productCounts[data.name];
        
          // Check if the product name has a corresponding entry in productCounts
          if (productKey && products[productKey] != null) {
            try {
              // Update the `count` field in the document
              await doc.ref.update({
                count: (data.count||0) + (products[productKey]||0),
              });
            } catch (error) {
              console.error(`Error updating count for product ${doc.id}:`, error);
            }
          }
        }); 

      // Return success response
      return res.status(200).json({ 
        status:"success",
        orderData
      });
    } else {
      // 5. If customer does not exist, delete the created order
      await db.collection(mainCollection).doc(id).delete();
      
      // 6. Return an error message for customer not found
      return res.status(400).json({ message: 'Customer not found, order deleted' });
    }
    // (Optional) Sending notifications (Uncomment if needed)
    // sendNotification(outletId, address.fullAddress, id);

  } catch (error) {
    console.error("Error creating order:", error);
    await db.collection(mainCollection).doc(id).delete();
    res.status(500).json({ message: "Internal server error" });
  }
};



const getAllOrders = async (req, res) => {
  try {
    const { outletId, customerId, startDate, endDate ,deliveryPartnerId} = req.query
    const db = getFirestore()
    let query = db.collection(mainCollection)

    // Apply filters if provided
    if (outletId) {
      query = query.where("outletId", "==", outletId)
    }

    if (customerId) {
      query = query.where("customerId", "==", customerId)
    }
    if (deliveryPartnerId) {
      query = query.where("deliveryPartnerId", "==", deliveryPartnerId)
    }
    
    if (startDate && endDate) {
      query = query
        .where("createdAt", ">=", new Date(startDate))
        .where("createdAt", "<=", new Date(endDate))
    }

    // Default sorting by creation date
    query = query.orderBy("createdAt", "desc")

    const snapshot = await query.get()

    if (snapshot.empty) {
      return res.status(404).json({ message: "No orders found" })
    }

    const orders = []
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() })
    })

    res.status(200).json({size:orders.length,orders})
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}


const getorderDetailsbyId = async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res.status(400).json({ message: "Order ID is required!" });
    }

    const db = getFirestore();

    //get order details and descard unwanted details
    const orderDocRef = db.collection(mainCollection).doc(id);
    const orderDoc = await orderDocRef.get();
    if (!orderDoc.exists) {
      return res.status(404).json({ message: "Order not found!" });
    }
    const orderData = { id: orderDoc.id, ...orderDoc.data() };
    const {outletId,customerId,...orderInfo} = orderData

    // Fetch customer details and descard the unwanted details
    const customerDocRef = db.collection("Customer").doc(customerId);
    const customerDoc = await customerDocRef.get();
    if (!customerDoc.exists) {
      return res.status(404).json({ message: "Customer not found!" });
    }
    const customerData = { id: customerDoc.id, ...customerDoc.data() };
    const {timeOfCreation,addresses,totalExpenditure,totalOrders,...customerInfo} = customerData

    
    // Fetch outlet details and exclude unwanted fields
    const outletDocRef = db.collection("Outlets").doc(outletId);
    const outletDoc = await outletDocRef.get();
    if (!outletDoc.exists) {
      return res.status(404).json({ message: "Outlet not found!" });
    }
    const outDataRaw = { id: outletDoc.id, ...outletDoc.data() };
    const { totalSales, deleveryPartners, ...outletInfo } = outDataRaw;

    // Consolidate response
    const order = { order: orderInfo, customer: customerInfo, outlet: outletInfo };
    res.status(200).json(order);

  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const cancelOrder = async (req, res) => {
  try {
      const orderId = req.params.orderId;

      if(!orderId) return res.status(500).json({message:"Order id is required!"})

      const db = getFirestore()
      const orderRef = db.collection('Order').doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
          return res.status(404).json({ message: 'Order not found' });
      }

      const orderData = orderDoc.data();

      if (orderData?.status !== 'Pending') {
          return res.status(400).json({ message: 'Order cannot be canceled' });
      }

      await orderRef.update({ status: 'canceled' });

      return res.json({ message: 'Order canceled successfully', orderId });
  } catch (error) {
      return res.status(500).json({ message: 'Error canceling order', error: error.message });
  }
}


// Handler function to find all outlets within 5 km range from the given coordinates
// const findNearbyOutlets = async (req, res) => {
//   try {
//     const db = getFirestore();
    
//     const orderCoordinates = { lat: 40.75, long: -73.96}; // Input coordinates
//     let maxDistance = 100000000000; // Maximum distance in kilometers
    
//     const outletsRef = db.collection('Outlets');
//     const snapshot = await outletsRef.get();

//     let nearbyOutlet ={};

//     snapshot.forEach(doc => {
//       const outletData = doc.data();
//       const outletCoords = outletData.address.coordinates;
      
//       const distance = haversineDistance(orderCoordinates, {
//         lat: outletCoords.lat,
//         long: outletCoords.long
//       });
      
//       if (distance < maxDistance) {
//         maxDistance=distance
//         nearbyOutlet={
//           id:outletData.id || 'NA',
//           name:outletData.name || 'NA',
//           phNo:outletData.phNo || 'NA',
//           img:outletData.img || 'NA',
//           distance:distance.toFixed(2) + 'KM'
//         };
//       }
//     });

//     if (Object.keys(nearbyOutlet).length==0) {
//       return res.status(404).json({status:"fail",message:'No nearby outlets found within 5 km.'});
//     }

//     // Return the nearby outlet
//     res.status(200).json({
//       status: 'success',
//       nearbyOutlet
//     });
//   } catch (error) {
//     console.error('Error finding outlets:', error);
//     res.status(500).json({message:'Error finding outlets'});
//   }
// };

//for shipping charges


const settingsCollection = "Settings";
const shippingDocId = "shipping";

// Get Shipping Charge
const getShippingCharge = async (req, res) => {
    try {
        const db = getFirestore();
        const shippingDoc = await db.collection(settingsCollection).doc(shippingDocId).get();

        if (shippingDoc.exists) {
            const shippingData = shippingDoc.data();
            res.status(200).json({ charge: shippingData.charge || 0 });
        } else {
            res.status(404).json({ message: "Shipping charge not found." });
        }
    } catch (error) {
        console.error("Error getting shipping charge:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Update Shipping Charge
const updateShippingCharge = async (req, res) => {
    try {
        const { charge } = req.body;
        if (typeof charge !== 'number') {
            return res.status(400).json({ message: "Charge must be a number." });
        }

        const db = getFirestore();
        await db.collection(settingsCollection).doc(shippingDocId).set({ charge });

        res.status(200).json({ message: "Shipping charge updated successfully." });
    } catch (error) {
        console.error("Error updating shipping charge:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};



export {
    newOrder,
    getAllOrders,
    getorderDetailsbyId,
    cancelOrder,
    getShippingCharge,
    updateShippingCharge,
};


