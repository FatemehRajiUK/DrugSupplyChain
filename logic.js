/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * 
  @param {org.improvementdrugsupplychain.drug.Drug_Product} Drug_Product - the Drug_Product transaction
  @transaction
 */
function produceShipment(drug_Product) {//Factory and Pharmacy transactions

    var contractF = drug_Product.drug.contractF;
    var producer = drug_Product.drug;
    var owner = drug_Product.drug.owner;

    producer.status = 'produced';

    if (owner.credit > contractF.threshold) {
        console.log('Manufacture ok');
        var message = 'Manufacture ok';
    } else {
        console.log('Manufacture not ok')
        var message = 'Manufacture not ok';
    };

    var factory = getFactory();
    var NS = 'org.improvementdrugsupplychain.drug';

    var Drug_Produced_Notification = factory.newEvent(NS, 'Drug_Produced_Notification');
    Drug_Produced_Notification.message = message;
    emit(Drug_Produced_Notification);
    return getParticipantRegistry('org.improvementdrugsupplychain.drug.Producer')

        .then(function () {
            return getAssetRegistry('org.improvementdrugsupplychain.drug.Drug');
        });
}



/**
* 
@param { org.improvementdrugsupplychain.drug.Drug_Distributors} Drug_Distributors - the Drug_Recived transaction
@transaction
*/
function receiveShipment(shipmentReceived) {

    var contractFW = shipmentReceived.drug.contractFW;
    var shipment = shipmentReceived.drug;
    var payOut = contractFW.shippingFee * shipment.druguid;//Transportation costs
    console.log('-----------------------------------------------------------------------------------------------------------');
    console.log('Time of receipt of Drug: ' + shipmentReceived.timestamp);
    console.log('Time of arrival: ' + contractFW.arrivalDateTime + 1);

    // set the status of the shipment
    shipment.status = 'IN_TRANSIT';

    if (shipmentReceived.timestamp > contractFW.arrivalDateTime) {
        payOut = 0;
        console.log('Arrival late');
    } else {
        if (shipment.temperatureReadings) {
            shipment.temperatureReadings.sort(function (a, b) {
                return (a.centigrade - b.centigrade);
            });
            var lowestReading = shipment.temperatureReadings[0];
            var highestReading = shipment.temperatureReadings[shipment.temperatureReadings.length - 1];
            var penalty = 0;
            console.log('Minimum temperature reading:' + lowestReading.centigrade);
            console.log('Maximum temperature reading:' + highestReading.centigrade);

            if (lowestReading.centigrade < contractFW.minTemperature) {
                penalty += (contractFW.minTemperature - lowestReading.centigrade) * contractFW.minPenaltyFactor;
                console.log('Low temperature penalty amount: ' + penalty * shipment.druguid + 'dollar');
            }

            if (highestReading.centigrade > contractFW.maxTemperature) {
                penalty += (highestReading.centigrade - contractFW.maxTemperature) * contractFW.maxPenaltyFactor1;
                console.log('High temperature penalty amount: ' + penalty + 'dollar');
            }

            payOut -= (penalty * shipment.druguid);

            if (payOut < 0) {
                payOut = 0;
            }
        }
    }
    console.log('The transportation fee is 10 dollar/kg');
    console.log('Shipping fee: ' + payOut);
    contractFW.producer.accountBalance -= payOut;
    contractFW.shipper.accountBalance += payOut;

    console.log('Manufacturer: ' + contractFW.producer.$identifier + ' Amount paid: ' + contractFW.producer.accountBalance + 'dollar');
    console.log('Logistics company: ' + contractFW.shipper.$identifier + ' Amount obtained: ' + contractFW.shipper.accountBalance + 'dollar');

    var NS = 'org.improvementdrugsupplychain.drug';
    shipment.shipmentReceived = shipmentReceived;

    var factory = getFactory();
    var drug_Received_Notification = factory.newEvent(NS, 'Drug_Received_Notification');
    var message = 'Drug' + shipment.$identifier + 'received';
    console.log(message);
    drug_Received_Notification.message = message;
    drug_Received_Notification.drug = shipment;
    emit(drug_Received_Notification);

    return getParticipantRegistry('org.improvementdrugsupplychain.drug.Producer')
        .then(function (producerRegistry) {
            return producerRegistry.update(contractFW.producer);
        })
        .then(function () {
            return getParticipantRegistry('org.improvementdrugsupplychain.drug.Shipper');
        })
        .then(function (shipperRegistry) {
            return shipperRegistry.update(contractFW.shipper);
        })
        .then(function () {
            return getAssetRegistry('org.improvementdrugsupplychain.drug.Drug');
        })
        .then(function (shipmentRegistry) {
            return shipmentRegistry.update(shipment);
        });
}


/**
 * 
  @param { org.improvementdrugsupplychain.drug.TemperatureReading} temperatureReading - the TemperatureReading transaction
  @transaction
 */
function temperatureReading(temperatureReading) {

    var shipment = temperatureReading.drug;
    var NS = 'org.improvementdrugsupplychain.drug';
    var contractFW = shipment.contractFW;
    var factory = getFactory();
    console.log('--------------------------------------------------------------------------------------');
    console.log('Add temperature reading ' + temperatureReading.centigrade + ' the goods ' + shipment.$identifier);

    if (shipment.temperatureReadings) {
        shipment.temperatureReadings.push(temperatureReading);
    } else {
        shipment.temperatureReadings = [temperatureReading];
    }

    var temperatureEvent = factory.newEvent(NS, 'TemperatureThreshold');
    temperatureEvent.drug = shipment;
    temperatureEvent.temperature = temperatureReading.centigrade;
    temperatureEvent.message = 'Send temperature events: ' + shipment.$identifier;
    emit(temperatureEvent);


    return getAssetRegistry(NS + '.Drug')
        .then(function (shipmentRegistry) {
            return shipmentRegistry.update(shipment);
        });
}

/**
 * 
  @param {org.improvementdrugsupplychain.drug.GpsReading} gpsReading - the GpsReading transaction
  @transaction
 */
function gpsReading(gpsReading) {

    var factory = getFactory();
    var NS = "org.improvementdrugsupplychain.drug";
    var shipment = gpsReading.drug;
    var PORT_OF_Hamedan = '/Latitude:39.6N/Longitude:115.9W';
    console.log('------------------------------------------------------------------------------');
    if (shipment.gpsReadings) {
        shipment.gpsReadings.push(gpsReading);
    } else {
        shipment.gpsReadings = [gpsReading];
    }

    var latLong = '/latitude:' + gpsReading.latitude + gpsReading.latitudeDir + '/longitude:' +
        gpsReading.longitude + gpsReading.longitudeDir;

    if (latLong == PORT_OF_Hamedan) {
        var drug_InPort_Notification = factory.newEvent(NS, 'Drug_InPort_Notification');
        drug_InPort_Notification.drug = shipment;
        var message = 'The goods have reached the destination ' + PORT_OF_Hamedan;
        drug_InPort_Notification.message = message;
        console.log(drug_InPort_Notification.message);
        emit(drug_InPort_Notification);
    } else {
        var drug_InPort_Notification = factory.newEvent(NS, 'Drug_InPort_Notification');
        drug_InPort_Notification.drug = shipment;
        var message = 'The goods did not reach the destination' + latLong;
        drug_InPort_Notification.message = message;
        console.log(drug_InPort_Notification.message);
        emit(drug_InPort_Notification);
    }

    return getAssetRegistry(NS + '.Drug')
        .then(function (shipmentRegistry) {
            return shipmentRegistry.update(shipment);
        });
}


/**
 * Drug_Selled - invoked when the Shipment has been picked up from the packer.
 * 
  @param {org.improvementdrugsupplychain.drug.Drug_Selled} drug_Selled - the Drug_Selled transaction
  @transaction
 */
function pickupShipment(drug_Selled) {
    var shipment = drug_Selled.drug;
    var NS = 'org.improvementdrugsupplychain.drug';
    var contractFW = shipment.contractFW;
    var factory = getFactory();

    shipment.drug_Selled = drug_Selled;

    var message = 'Goods have been shipped ' + shipment.$identifier;

    console.log(message);

    var drug_SelledEvent = factory.newEvent(NS, 'Drug_Selled_Notification');
    drug_SelledEvent.drug = shipment;
    drug_SelledEvent.message = message;
    console.log(drug_SelledEvent.message);
    emit(drug_SelledEvent);

    return getAssetRegistry(NS + '.Drug')
        .then(function (shipmentRegistry) {
            return shipmentRegistry.update(shipment);
        });
}






/**
 * Initialize some test assets and participants useful for running a demo.
 * @param {org.improvementdrugsupplychain.drug.SetupDemo} setupDemo - the SetupDemo transaction
 * @transaction
 */
function instantiateModelForTesting(setupDemo) {
    console.log('Data information initialization...');
    console.log('There are four participants: manufacturers, Distributor companies, Pharmacy, Patient');
    console.log('The cargo transported is Drug, the quantity is 1000kg')
    console.log('----------------------------------------------------------------');
    var factory = getFactory();
    var NS = 'org.improvementdrugsupplychain.drug';

    // create the producer
    var producer = factory.newResource(NS, 'Producer', 'drug_factory');

    producer.Full_name = 'producerAddress';
    producer.Id = '1';
    producer.credit = 0;
    producer.accountBalance = 0;
    // create the shipper
    var shipper = factory.newResource(NS, 'Shipper', 'S.F.Express');
    shipper.Full_name = 'shipperAddress';
    shipper.Id = '1';
    shipper.credit = 0;
    shipper.accountBalance = 0;
    // create the pharmacy
    var pharmacy = factory.newResource(NS, 'Pharmacy', 'S.F.Pharmacy');
    pharmacy.Full_name = 'PharmacyAddress';
    pharmacy.Id = '1';
    pharmacy.accountBalance = 0;
    pharmacy.credit = 0;

    // create the patient
    var patient = factory.newResource(NS, 'Patient', 'patient.E');
    patient.Id = '11';
    patient.Full_name = 'patientAddress';

    // create the Temperature sensor
    var temperatureSensor = factory.newResource(NS, 'TemperatureSensor', 'SENSOR_TEMP001');

    // create the GPS sensor
    var gpsSensor = factory.newResource(NS, 'GpsSensor', 'SENSOR_GPS001');


    // create the  contractFW
    var contractFW = factory.newResource(NS, 'ContractFW', 'CON_001');
    contractFW.producer = factory.newRelationship(NS, 'Producer', 'Drug_factory');
    contractFW.shipper = factory.newRelationship(NS, 'Shipper', 'S.F.Express');
    var tomorrow = setupDemo.timestamp;
    tomorrow.setDate(tomorrow.getDate() + 1);
    contractFW.arrivalDateTime = tomorrow; // the shipment has to arrive tomorrow
    contractFW.shippingFee = 5; // pay 50 cents per unit
    contractFW.minTemperature = 2; // min temperature for the cargo
    contractFW.maxTemperature = 10; // max temperature for the cargo
    contractFW.minPenaltyFactor = 0.2; // we reduce the price by 20 cents for every degree below the min temp
    contractFW.maxPenaltyFactor1 = 0.1; // we reduce the price by 10 cents for every degree above the max temp
    // create the  contractF
    var contractF = factory.newResource(NS, 'ContractFW', 'CON_001');
    contractF.producer = factory.newRelationship(NS, 'Producer', 'Drug_factory');
    contractF.threshold = 1; // the shipment has to arrive tomorrow


    return getParticipantRegistry(NS + '.Producer')
        .then(function (producerRegistry) {
            // add the growers
            return producerRegistry.addAll([producer]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.Patient');
        })
        .then(function (patientRegistry) {
            // add the importers
            return patientRegistry.addAll([patient]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.Pharmacy');
        })
        .then(function (pharmacyRegistry) {
            // add the importers
            return pharmacyRegistry.addAll([pharmacy]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.Shipper');
        })
        .then(function (shipperRegistry) {
            // add the shippers
            return shipperRegistry.addAll([shipper]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.TemperatureSensor');
        })
        .then(function (temperatureSensorRegistry) {
            // add the temperature sensors
            return temperatureSensorRegistry.addAll([temperatureSensor]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.GpsSensor');
        })
        .then(function (gpsSensorRegistry) {
            // add the GPS sensors
            return gpsSensorRegistry.addAll([gpsSensor]);
        })


        .then(function () {
            return getAssetRegistry(NS + '.ContractFW');
        })
        .then(function () {
            return getAssetRegistry(NS + '.ContractF');
        })
        .then(function (contractFWRegistry) {
            // add the contracts
            return contractFWRegistry.addAll([contractFW]);
        })

        .then(function (contractFRegistry) {
            // add the contracts
            return contractFRegistry.addAll([contractF]);
        })
        .then(function () {
            return getAssetRegistry(NS + '.Shipment');
        })
        .then(function (shipmentRegistry) {
            // add the shipments
            return shipmentRegistry.addAll([shipment]);
        });
}
