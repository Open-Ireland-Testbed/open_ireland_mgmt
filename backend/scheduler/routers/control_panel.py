import os
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
import yaml
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import requests 

from backend.scheduler.routers.admin import admin_required  
from backend.core.deps import get_db
from backend.scheduler.schemas import PDUCreate, PDUResponse, OutletControl, SensorData, Sensor

# Raritan SDK 
from raritan import rpc
from raritan.rpc import pdumodel, peripheral


router = APIRouter(prefix="/control-panel", tags=["control-panel"])

CONFIG_PATH = os.getenv("PDU_CONFIG_PATH", "config.yaml")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database dependency is now imported from deps.py


def load_config():
    """ Load PDU Config file """
    try:
        with open(CONFIG_PATH, 'r') as f:
            config = yaml.safe_load(f)
            
            # Create Sensor Object
            for pdu_config in config.get('pdus', []):
                sensors_config = pdu_config.get('sensors', [])
                pdu_config['sensors'] = [Sensor(**sensor) for sensor in sensors_config]
                
            return config
    except Exception as e:
        logger.error(f"Failed to load config: {e}")
        raise HTTPException(status_code=500, detail="Failed to load configuration")

def save_config(config):
    """Save PDU Config file """
    try:
        # Convert Sensor object to dictionary
        for pdu_config in config.get('pdus', []):
            sensors = pdu_config.get('sensors', [])
            pdu_config['sensors'] = [sensor.dict() for sensor in sensors]
            
        with open(CONFIG_PATH, 'w') as f:
            yaml.dump(config, f, default_flow_style=False)
    except Exception as e:
        logger.error(f"Failed to save config: {e}")
        raise HTTPException(status_code=500, detail="Failed to save configuration")


class PduController:
    """Raritan PDU Controller """
    
    def __init__(self, host: str, user: str, passwd: str, pdu_path: str, name: str):
        self.name = name
        self.host = host
        self.agent = rpc.Agent("http", host, user, passwd)
        self.pdu = pdumodel.Pdu(pdu_path, self.agent)
        self.pdm = peripheral.DeviceManager("/model/peripheraldevicemanager", self.agent)
        
        try:
            self.all_slots = self.pdm.getDeviceSlots()
        except Exception as e:
            logger.error(f"Error getting device slots: {e}")
            self.all_slots = []
            
        self.humidity_slot: Optional[int] = None
        for i, slot in enumerate(self.all_slots):
            try:
                name_setting = slot.getSettings().name or ""
                if "hum" in name_setting.lower():
                    self.humidity_slot = i
                    break
            except Exception as e:
                logger.warning(f"Error checking slot {i}: {e}")
                    
        logger.info(f"[{self.name}] Connected to {host}, {len(self.all_slots)} slots available.")
    
    
    def set_outlet_status(self, outlet_number: int, status: str) -> None:
        """Set the outlet status"""
        try:
            outlets = self.pdu.getOutlets()
            outlet_idx = outlet_number - 1
            if outlet_idx >= len(outlets):
                raise HTTPException(status_code=404, detail="Outlet not found")
                
            target_state = pdumodel.Outlet.PowerState.PS_ON if status == "on" else pdumodel.Outlet.PowerState.PS_OFF
            outlets[outlet_idx].setPowerState(target_state)
        except Exception as e:
            logger.error(f"Error setting outlet status: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to set outlet status: {str(e)}")
    
    def get_temp(self, slot_idx: int) -> Dict[str, Any]:
        """Read temp"""
        if slot_idx >= len(self.all_slots):
            raise HTTPException(status_code=404, detail="Sensor slot not found")
            
        slot = self.all_slots[slot_idx]
        dev = slot.getDevice()
        
        if not dev or not dev.device:
            raise HTTPException(status_code=404, detail="Sensor device not found")
            
        sensor = dev.device
        
        try:
            reading = sensor.getReading()
        except Exception as e:
            logger.error(f"Error getting sensor reading: {e}")
            return {"value": "N/A", "unit": "unknown"}
            
        if hasattr(reading, "getValue"):
            value = reading.getValue()
        elif hasattr(reading, "value"):
            value = reading.value
        else:
            logger.error("Unexpected sensor reading format")
            return {"value": "N/A", "unit": "unknown"}
            
        return {
            "value": float(value),
            "unit": getattr(reading, "unit", "unknown")
        }
    
    def get_humidity(self) -> Optional[float]:
        """Read humidity"""
        if self.humidity_slot is None:
            return None
            
        slot = self.all_slots[self.humidity_slot]
        dev = slot.getDevice()
        
        if not dev or not dev.device:
            return None
            
        try:
            reading = dev.device.getReading()
        except Exception as e:
            logger.error(f"Error getting humidity reading: {e}")
            return None
            
        if hasattr(reading, "getValue"):
            value = reading.getValue()
        elif hasattr(reading, "value"):
            value = reading.value
        else:
            return None
            
        return round(float(value), 2)
    
    def get_power(self) -> Optional[float]:
        """Get total power"""

        external_api_base = "http://10.10.10.8:8001/model/pdu"

        # Create 
        api_url = f"{external_api_base}/{self.name}/context"
        
        try:
            # Call external API to acquire power
            response = requests.get(api_url, timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                power = data.get("totalPowerW")
                
                if power is not None:
                    return round(float(power), 0)
                else:
                    logger.warning(f"The poswer is empty: {data}")
                    return None
            else:
                logger.error(f"The API request failed with a status code: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"An error occurred while calling the external API to get power: {e}")
            return None

    def get_outlets(self) -> List[Dict[str, Any]]:
        """Get outlet status via external API"""
        external_api_base = "http://10.10.10.8:8001/model/pdu"

        api_url = f"{external_api_base}/{self.name}/outlets"
        
        try:
            response = requests.get(api_url, timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                
                for outlet in data:
                    if 'state' in outlet:
                        # Convert the status according to boolean value. True => ON, False => OFF
                        outlet['status'] = "on" if outlet['state'] else "off"
                        del outlet['state']
                    outlet['number'] = outlet.get('number', 0)
                    
                return data
            else:
                logger.error(f"API request failed with status code: {response.status_code}, Response: {response.text}")
                return []
                
        except Exception as e:
            logger.error(f"Error calling external API to get outlets: {e}")
            return []

    @staticmethod
    def get_pdu_controller(pdu_name: str) -> "PduController":
        """Get PDU Controller instance"""
        config = load_config()
        pdu_config = next((p for p in config.get('pdus', []) if p['name'] == pdu_name), None)

        if not pdu_config:
            raise HTTPException(status_code=404, detail="PDU not found")

        if pdu_name not in PDU_CONTROLLERS:
            try:
                controller = PduController(
                    pdu_config["host"],
                    pdu_config["user"],
                    pdu_config["passwd"],
                    pdu_config["pdu_path"],
                    pdu_config["name"]
                )
                PDU_CONTROLLERS[pdu_name] = controller
            except Exception as e:
                logger.error(f"Failed to connect PDU {pdu_name}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to connect to PDU: {str(e)}")

        return PDU_CONTROLLERS[pdu_name]


# PDU Controller Cash
PDU_CONTROLLERS: Dict[str, PduController] = {}


# ================== Get all PDU info ==================
@router.get("/pdus", response_model=List[PDUResponse])
def get_all_pdus(auth: None = Depends(admin_required)):
    pdus = load_config().get('pdus', [])
    return pdus


# ================== Get PDU power ==================
@router.get("/pdus/{pdu_name}/power", response_model=Dict[str, Any])
def get_pdu_power(pdu_name: str, auth: None = Depends(admin_required)):
    config = load_config()
    pdu_config = next((p for p in config.get('pdus', []) if p['name'] == pdu_name), None)

    if not pdu_config:
        raise HTTPException(status_code=404, detail="PDU not found")

    try:
        controller = PduController.get_pdu_controller(pdu_name)
        power = controller.get_power()
        
        if power is not None:
            pdu_config['power'] = power
            pdu_config['last_updated'] = datetime.now().isoformat()
            save_config(config)
            
            return {"power": power, "unit": "Watt"}
        else:
            return {"power": "N/A", "unit": "Watt", "message": "Failed to retrieve power data"}
            
    except Exception as e:
        logger.error(f"Failed to get power: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get power: {str(e)}")


# ================== Test PDU connection ==================
@router.post("/pdus/{pdu_name}/connect")
def connect_pdu(pdu_name: str, auth: None = Depends(admin_required)):
    config = load_config()
    pdu_config = next((p for p in config.get('pdus', []) if p['name'] == pdu_name), None)
    
    if not pdu_config:
        raise HTTPException(status_code=404, detail="PDU not found")
    
    try:
        controller = PduController.get_pdu_controller(pdu_name)
        
        pdu_config['connected'] = True
        pdu_config['last_updated'] = datetime.now().isoformat()
        
        power = controller.get_power()
        if power is not None:
            pdu_config['power'] = power
        
        save_config(config)
        
        return {"message": f"PDU {pdu_name} connected successfully"}
    except Exception as e:
        if pdu_config:
            pdu_config['connected'] = False
            pdu_config['last_updated'] = datetime.now().isoformat()
            save_config(config)
            
        logger.error(f"Failed to connect to PDU: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to PDU: {str(e)}")


# ================== Get Specified PDU info ==================
@router.get("/pdus/{pdu_name}", response_model=PDUResponse)
def get_pdu(pdu_name: str, auth: None = Depends(admin_required)):
    pdus = load_config().get('pdus', [])
    pdu = next((p for p in pdus if p['name'] == pdu_name), None)
    if not pdu:
        raise HTTPException(status_code=404, detail="PDU not found")
    return pdu


# ================== Add new PDU ==================
@router.post("/pdus", response_model=PDUResponse)
def add_pdu(pdu: PDUCreate, auth: None = Depends(admin_required)):
    config = load_config()
    
    # Check if the pdu is repeated
    if any(existing['name'] == pdu.name for existing in config.get('pdus', [])):
        raise HTTPException(status_code=400, detail="PDU with this name already exists")
    
    if any(existing['host'] == pdu.host for existing in config.get('pdus', [])):
        raise HTTPException(status_code=400, detail="PDU with this IP already exists")
    
    # Add New PDU
    new_pdu = {
        'name': pdu.name,
        'host': pdu.host,
        'user': pdu.user,
        'passwd': pdu.passwd,
        'pdu_path': pdu.pdu_path,
        'external_id': pdu.external_id,  
        'sensors': pdu.sensors or [],
        'outlets': pdu.outlets or [],
        'connected': False,
        'temperature': None,
        'humidity': None,
        'power': None,  
        'last_updated': datetime.now().isoformat()
    }
    
    config.setdefault('pdus', []).append(new_pdu)
    save_config(config)
    
    # Connect if the pdu is added successfully
    if pdu.connected:
        try:
            controller = PduController.get_pdu_controller(pdu.name)
            new_pdu['connected'] = True
            
            # Get PDU sensor data
            if new_pdu.get('sensors') and new_pdu['sensors']:
                sensor_slot = new_pdu['sensors'][0].slot_idx
                sensor_data = controller.get_temp(sensor_slot)
                new_pdu['temperature'] = sensor_data['value']
            
            new_pdu['humidity'] = controller.get_humidity()
            
            # Get power data
            new_pdu['power'] = controller.get_power()
            
            new_pdu['last_updated'] = datetime.now().isoformat()
            save_config(config)
        except Exception as e:
            logger.warning(f"Auto-connect failed for new PDU {pdu.name}: {e}")
    
    return new_pdu


# ================== Delete the PDU ==================
@router.delete("/pdus/{pdu_name}")
def delete_pdu(pdu_name: str, auth: None = Depends(admin_required)):
    config = load_config()
    pdus = config.get('pdus', [])

    for i, pdu in enumerate(pdus):
        if pdu['name'] == pdu_name:
            del pdus[i]
            if pdu_name in PDU_CONTROLLERS:
                del PDU_CONTROLLERS[pdu_name]
            save_config(config)
            return {"message": f"PDU {pdu_name} deleted successfully"}

    raise HTTPException(status_code=404, detail="PDU not found")


# ================== Get sensor info from pdu ==================
@router.get("/pdus/{pdu_name}/sensors", response_model=SensorData)
def get_pdu_sensors(pdu_name: str, auth: None = Depends(admin_required)):
    config = load_config()
    pdu_config = next((p for p in config.get('pdus', []) if p['name'] == pdu_name), None)

    if not pdu_config:
        raise HTTPException(status_code=404, detail="PDU not found")

    try:
       
        controller = PduController.get_pdu_controller(pdu_name)
        
        # Temp data
        temperature = None
        if pdu_config.get('sensors') and pdu_config['sensors']:
            sensor_slot = pdu_config['sensors'][0].slot_idx
            sensor_data = controller.get_temp(sensor_slot)
            temperature = sensor_data['value']

        humidity = controller.get_humidity()
        
        # Power Data
        power = controller.get_power()

        # Upate the config
        pdu_config['temperature'] = temperature
        pdu_config['humidity'] = humidity
        pdu_config['power'] = power
        pdu_config['last_updated'] = datetime.now().isoformat()
        save_config(config)

        return {
            "temperature": temperature,
            "humidity": humidity,
            "power": power
        }

    except Exception as e:
        if pdu_config:
            pdu_config['connected'] = False
            pdu_config['last_updated'] = datetime.now().isoformat()
            save_config(config)
            
        logger.error(f"Failed to read sensor: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read sensors: {str(e)}")


# ================== Control DPU outlets ==================
@router.post("/pdus/{pdu_name}/outlets/{outlet_idx}/control")
def control_pdu_outlet(
    pdu_name: str, 
    outlet_idx: int, 
    control: OutletControl, 
    auth: None = Depends(admin_required)
):
    config = load_config()
    pdu_config = next((p for p in config.get('pdus', []) if p['name'] == pdu_name), None)

    if not pdu_config:
        raise HTTPException(status_code=404, detail="PDU not found")

    try:
        # Chnage PDU outlet status
        controller = PduController.get_pdu_controller(pdu_name)
        controller.set_outlet_status(outlet_idx, control.status)
        
        # Update the outlet status
        if 'outlets' not in pdu_config:
            pdu_config['outlets'] = []
        
        outlet_config = next(
            (o for o in pdu_config['outlets'] if o.get('outlet_idx') == outlet_idx),  
            None
        )
        
        if not outlet_config:
            outlet_config = {'outlet_idx': outlet_idx}  
            pdu_config['outlets'].append(outlet_config)
        
        outlet_config['status'] = control.status
        
        # Update the power
        pdu_config['power'] = controller.get_power()
        
        pdu_config['last_updated'] = datetime.now().isoformat()
        save_config(config)
        
        return {
            "message": f"PDU {pdu_name} outlet {outlet_idx} set to {control.status}",
            "outlet": {
                "number": outlet_idx,
                "status": control.status
            }
        }
    except Exception as e:
        logger.error(f"Failed to control outlet: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to control outlet: {str(e)}")

# ================== Get PDU outlets ==================
@router.get("/pdus/{pdu_name}/outlets", response_model=List[Dict[str, Any]])
def get_pdu_outlets(pdu_name: str, auth: None = Depends(admin_required)):
    config = load_config()
    pdu_config = next((p for p in config.get('pdus', []) if p['name'] == pdu_name), None)

    if not pdu_config:
        raise HTTPException(status_code=404, detail="PDU not found")

    if not pdu_config.get('connected', False):
        raise HTTPException(status_code=400, detail="PDU is not connected")

    try:
        controller = PduController.get_pdu_controller(pdu_name)
        outlets = controller.get_outlets() 
        
        # Merge with configured outlet information
        configured_outlets = pdu_config.get('outlets', [])
        configured_map = {o.get('outlet_idx'): o for o in configured_outlets}
        
        for outlet in outlets:
            if outlet['number'] in configured_map:
                configured = configured_map[outlet['number']]
                outlet['device'] = configured.get('device_name', 'Unknown Device')
                # Use configured status if available
                if 'status' in configured:
                    outlet['status'] = configured['status']
        
        return outlets
            
    except Exception as e:
        logger.error(f"Failed to get outlets: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get outlets: {str(e)}")


# ================== Get All DPUs data statistics info ==================
@router.get("/status")
def get_system_stats(auth: None = Depends(admin_required)):
    pdus = load_config().get('pdus', [])
    
    total_pdus = len(pdus)
    connected_pdus = len([p for p in pdus if p.get('connected', False)])
    
    temperatures = []
    total_power = 0
    power_count = 0
    
    for pdu in pdus:
        if pdu.get('connected', False):
            try:
                sensors = get_pdu_sensors(pdu['name'])
                if sensors['temperature'] is not None:
                    temperatures.append(sensors['temperature'])
                if sensors['power'] is not None:
                    total_power += sensors['power']
                    power_count += 1
            except HTTPException:
                continue
    
    avg_temperature = sum(temperatures) / len(temperatures) if temperatures else 0
    avg_power = total_power / power_count if power_count > 0 else 0
    
    return {
        "total_pdus": total_pdus,
        "connected_pdus": connected_pdus,
        "avg_temperature": round(avg_temperature, 2) if avg_temperature else "N/A",
        "total_power": round(total_power, 2) if power_count > 0 else "N/A"
    }    

# ================== Update outlet device name ==================
@router.put("/pdus/{pdu_name}/outlets/{outlet_idx}/device")
def update_outlet_device_name(
    pdu_name: str, 
    outlet_idx: int, 
    device_data: Dict[str, str],
    auth: None = Depends(admin_required)
):
    config = load_config()
    pdu_config = next((p for p in config.get('pdus', []) if p['name'] == pdu_name), None)

    if not pdu_config:
        raise HTTPException(status_code=404, detail="PDU not found")

    try:
        # Ensure outlets list exists
        if 'outlets' not in pdu_config:
            pdu_config['outlets'] = []
        
        # Find existing outlet configuration or create new
        outlet_config = next(
            (o for o in pdu_config['outlets'] if o.get('outlet_idx') == outlet_idx),  
            None
        )
        
        if not outlet_config:
            outlet_config = {'outlet_idx': outlet_idx}  
            pdu_config['outlets'].append(outlet_config)
        
        # Update device name
        outlet_config['device_name'] = device_data.get('device_name', 'Unknown Device')
        
        # Update timestamp
        pdu_config['last_updated'] = datetime.now().isoformat()
        save_config(config)
        
        return {
            "message": f"PDU {pdu_name} outlet {outlet_idx} device name updated",
            "device_name": outlet_config['device_name']
        }
    except Exception as e:
        logger.error(f"Failed to update device name: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update device name: {str(e)}")