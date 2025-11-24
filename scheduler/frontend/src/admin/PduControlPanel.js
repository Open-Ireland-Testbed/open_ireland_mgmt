import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import "./simpleControlPanel.css"
import { API_BASE_URL } from '../config/api';

const SimpleControlPanel = ({ onReturn }) => {
    const [pdus, setPdus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddPduModal, setShowAddPduModal] = useState(false);
    const [newPdu, setNewPdu] = useState({
        name: '',
        host: '',
        user: 'admin',
        passwd: 'password',
        pduPath: '/model/pdu/0',  // A path to identify and configure specific PDU devices
        external_id: '',
        sensors: [{ slot_idx: 0 }],
        outlets: []
    });

    // System status
    const [systemStatus, setSystemStatus] = useState(null);
    const [statusLoading, setStatusLoading] = useState(true);

    // The ref and width used for scrolling
    const pduListRef = useRef(null);
    const [pduCardWidth, setPduCardWidth] = useState(0);

    // Edit the device name for each outlet
    const [showEditDeviceModal, setShowEditDeviceModal] = useState(false)
    const [editingOutlet, setEditingOutlet] = useState({
        pduName: '',
        outletNumber: 0,
        deviceName: ''
    });

    // Fetch all PDUs (with authentication)
    const fetchPdus = async () => {
        setLoading(true);
        setError('');

        try {

            // Get pdu mapping data from the config.yaml
            const response = await fetch(`${API_BASE_URL}/control-panel/pdus`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Unauthorized, please log in as administrator first");
                } else if (response.status === 403) {
                    throw new Error("Permission denied, administrator privileges required");
                } else {
                    throw new Error(await response.text() || "Failed to fetch PDU data");
                }
            }

            const data = await response.json();

            // Get outlets info for each pdu
            const pdusWithOutlets = await Promise.all(data.map(async pdu => {
                if (pdu.connected) {
                    try {
                        const outletsResponse = await fetch(`${API_BASE_URL}/control-panel/pdus/${pdu.name}/outlets`, {
                            method: 'GET',
                            credentials: 'include'
                        });

                        if (outletsResponse.ok) {
                            const outlets = await outletsResponse.json();
                            return { ...pdu, outlets };
                        }
                    } catch (err) {
                        console.error(`Error fetching outlets for ${pdu.name}:`, err);
                    }
                }
                return { ...pdu, outlets: [] };
            }));

            setPdus(pdusWithOutlets);
        } catch (err) {
            setError(err.message);
            console.error("Error fetching PDU data:", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch system status
    const fetchSystemStatus = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/control-panel/status`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(await response.text() || "Failed to fetch system status");
            }

            return await response.json();
        } catch (err) {
            console.error("Error fetching system status:", err);
            return {
                total_pdus: 0,
                connected_pdus: 0,
                avg_temperature: "N/A",
                total_power: "N/A"
            };
        }
    };

    // Connect to PDU
    const connectPdu = async (pduName) => {
        try {
            const response = await fetch(`${API_BASE_URL}/control-panel/pdus/${pduName}/connect`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(await response.text() || "Failed to connect to PDU");
            }

            fetchPdus();
        } catch (err) {
            setError(err.message);
            console.error("Error connecting to PDU:", err);
        }
    };

    // Add new PDU
    const addNewPdu = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/control-panel/pdus`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newPdu.name,
                    host: newPdu.host,
                    user: newPdu.user,
                    passwd: newPdu.passwd,
                    pdu_path: newPdu.pduPath,
                    external_id: newPdu.external_id,
                    sensors: newPdu.sensors,
                    outlets: newPdu.outlets
                })
            });

            if (!response.ok) {
                throw new Error(await response.text() || "Failed to add PDU");
            }

            setShowAddPduModal(false);
            fetchPdus();
            setNewPdu({
                name: '',
                host: '',
                user: 'admin',
                passwd: 'password',
                pduPath: '/model/pdu/0',
                sensors: [{ slot_idx: 0 }],
                outlets: []
            });
        } catch (err) {
            setError(err.message);
            console.error("Error adding PDU:", err);
        }
    };

    // Delete PDU
    const deletePdu = async (pduName) => {
        if (window.confirm(`Are you sure you want to delete PDU: ${pduName}?`)) {
            try {
                const response = await fetch(`${API_BASE_URL}/control-panel/pdus/${pduName}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(await response.text() || "Failed to delete PDU");
                }

                fetchPdus();
            } catch (err) {
                setError(err.message);
                console.error("Error deleting PDU:", err);
            }
        }
    };

    // Control PDU outlet
    const controlOutlet = async (pduName, outletIdx, status) => {
        try {
            const response = await fetch(`${API_BASE_URL}/control-panel/pdus/${pduName}/outlets/${outletIdx}/control`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error(await response.text() || "Failed to control outlet");
            }

            fetchPdus();
        } catch (err) {
            setError(err.message);
            console.error("Error controlling outlet:", err);
        }
    };

    // Edit device name on each outlet
    const editDeviceName = async (pduName, outletNumber, deviceName) => {
        setEditingOutlet({
            pduName,
            outletNumber,
            deviceName
        })
        setShowEditDeviceModal(true);
    };

    // Save the deivce name 
    const saveDeviceName = async () => {
        try {
            const { pduName, outletNumber, deviceName } = editingOutlet;

            const response = await fetch(`${API_BASE_URL}/control-panel/pdus/${pduName}/outlets/${outletNumber}/device`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ device_name: deviceName })
            });

            if (!response.ok) {
                throw new Error(await response.text() || "Failed to update device name");
            }

            setShowEditDeviceModal(false);
            fetchPdus();

        } catch (err) {
            setError(err.message);
            console.error("Error updating device name:", err);
        }
    };






    // Calculate PDU card width
    useEffect(() => {
        if (pduListRef.current) {
            const card = pduListRef.current.firstChild;
            if (card) {
                setPduCardWidth(card.offsetWidth + 20);
            }
        }
    }, [pdus]);

    // Fetch data when component mounts
    useEffect(() => {
        fetchPdus();

        // Fetch system status
        const loadStatus = async () => {
            setStatusLoading(true);
            const status = await fetchSystemStatus();
            setSystemStatus(status);
            setStatusLoading(false);
        };

        loadStatus();
    }, []);

    return (
        <div className="control-panel-container">
            <div className="page-header">
                <h2>PDU Control Panel</h2>
                <button className="return-button" onClick={onReturn}>
                    Return to Main Menu
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* Loading information */}
            {loading ? (
                <div className="loading">Loading PDU data...</div>
            ) : pdus.length === 0 ? (
                <div className="empty-state">
                    <p>No PDU devices configured. Click "Add PDU" to add a new device.</p>
                </div>
            ) : (
                <div className="pdu-control-panel">
                    {/* Statistics Panel */}
                    <div className="stats-cards">
                        {statusLoading ? (
                            <div className="loading">Loading system status...</div>
                        ) : systemStatus ? (
                            <React.Fragment>
                                <div className="stat-card">
                                    <span className="icon power">⚡</span>
                                    <div>
                                        <h4>Total PDUs</h4>
                                        <p>{systemStatus.total_pdus}</p>
                                    </div>
                                </div>

                                <div className="stat-card">
                                    <span className="icon connect">🔌</span>
                                    <div>
                                        <h4>Connected</h4>
                                        <p>{systemStatus.connected_pdus}</p>
                                    </div>
                                </div>

                                <div className="stat-card">
                                    <span className="icon temperature">🌡️</span>
                                    <div>
                                        <h4>Average Temperature</h4>
                                        <p>{systemStatus.avg_temperature}</p>
                                    </div>
                                </div>

                                <div className="stat-card">
                                    <span className="icon power">⚡</span>
                                    <div>
                                        <h4>Total Power</h4>
                                        <p>{systemStatus.total_power}</p>
                                    </div>
                                </div>
                            </React.Fragment>
                        ) : (
                            <div className="error-message">Failed to load system status</div>
                        )}
                    </div>

                    {/* Add PDU Button */}
                    <div className="add-pdu-btn-container">
                        <button
                            className="add-pdu-btn"
                            onClick={() => setShowAddPduModal(true)}
                        >
                            <span className="icon add">➕</span> Add New PDU
                        </button>
                    </div>

                    {/* PDU List with Scroll Buttons */}
                    <div className="pdu-list-container">
                        <button
                            className="pdu-scroll-btn prev"
                            onClick={() => pduListRef.current.scrollBy({ left: -pduCardWidth, behavior: 'smooth' })}
                            disabled={pdus.length <= 3}
                        >
                            ←
                        </button>
                        <div ref={pduListRef} className="pdu-list">
                            {pdus.map(pdu => (
                                <div className="pdu-card" key={pdu.name}>
                                    <div className="pdu-header">
                                        <div>
                                            <h3>{pdu.name}</h3>
                                            <p className="pdu-host">{pdu.host}</p>
                                        </div>
                                        <div className="pdu-status">
                                            {pdu.connected ? (
                                                <span className="status-dot connected"></span>
                                            ) : (
                                                <span className="status-dot disconnected"></span>
                                            )}
                                            <span className="status-text">{pdu.connected ? "Connected" : "Disconnected"}</span>
                                        </div>
                                    </div>

                                    {/* Control Buttons */}
                                    <div className="pdu-controls">
                                        {!pdu.connected && (
                                            <button className="connect-btn" onClick={() => connectPdu(pdu.name)}>
                                                <span className="icon connect">🔌</span> Connect
                                            </button>
                                        )}
                                        <button className="delete-btn" onClick={() => deletePdu(pdu.name)}>
                                            <span className="icon delete">🗑️</span> Delete
                                        </button>
                                    </div>

                                    {/* Sensor Data */}
                                    {pdu.connected && (
                                        <div className="pdu-sensors">
                                            <div className="sensor-item">
                                                <span className="icon temperature">🌡️</span>
                                                <span>{pdu.temperature || "N/A"}°C</span>
                                            </div>
                                            {/* Only show humidity for PDU2 */}
                                            {pdu.name === 'PDU2' && pdu.humidity !== undefined && (
                                                <div className="sensor-item">
                                                    <span className="icon humidity">💧</span>
                                                    <span>{pdu.humidity || "N/A"}%</span>
                                                </div>
                                            )}
                                            <div className="sensor-item">
                                                <span className="icon power">⚡</span>
                                                <span>{pdu.power !== undefined && pdu.power !== null && !isNaN(pdu.power) ? Math.round(pdu.power) : "N/A"} W</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Outlets List with Scrollbar */}
                                    {pdu.connected && pdu.outlets && pdu.outlets.length > 0 && (
                                        <div className="outlets-list">
                                            <h4 className="outlets-header">Outlets</h4>
                                            <div className="outlet-grid">
                                                {pdu.outlets.map(outlet => (
                                                    <div className="outlet-item" key={outlet.number}>
                                                        <div className="outlet-header">
                                                            <span className="outlet-number">Outlet {outlet.number}</span>
                                                            <span className={`outlet-status ${outlet.status}`}>
                                                                {outlet.status === 'on' ? 'ON' : 'OFF'}
                                                            </span>
                                                        </div>

                                                        <div className="outlet-device-container">
                                                            <p className="outlet-device">{outlet.device || "Unknown Device"}</p>
                                                            <button
                                                                className="edit-device-btn"
                                                                onClick={() => editDeviceName(pdu.name, outlet.number, outlet.device || "")}
                                                            >
                                                                <span className="icon edit">✏️</span>
                                                            </button>
                                                        </div>

                                                        <div className="outlet-controls">
                                                            <button
                                                                className={`btn ${outlet.status === 'on' ? 'btn-off' : 'btn-on'}`}
                                                                onClick={() => controlOutlet(pdu.name, outlet.number, outlet.status === 'on' ? 'off' : 'on')}
                                                            >
                                                                {outlet.status === 'on' ? 'Turn Off' : 'Turn On'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            className="pdu-scroll-btn next"
                            onClick={() => pduListRef.current.scrollBy({ left: pduCardWidth, behavior: 'smooth' })}
                            disabled={pdus.length <= 3}
                        >
                            →
                        </button>
                    </div>
                </div>
            )}

            {/* Add PDU Modal */}
            {showAddPduModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Add New PDU Device</h3>
                            <button
                                className="close-modal"
                                onClick={() => setShowAddPduModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="pduName">PDU Name</label>
                                <input
                                    type="text"
                                    id="pduName"
                                    value={newPdu.name}
                                    onChange={(e) => setNewPdu({ ...newPdu, name: e.target.value })}
                                    placeholder="e.g., PDU-Rack01"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="pduExternalId">External ID</label>
                                <input
                                    type="text"
                                    id="pduExternalId"
                                    value={newPdu.external_id}
                                    onChange={(e) => setNewPdu({ ...newPdu, external_id: e.target.value })}
                                    placeholder="For example: PDU_ONE"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="pduHost">IP Address</label>
                                <input
                                    type="text"
                                    id="pduHost"
                                    value={newPdu.host}
                                    onChange={(e) => setNewPdu({ ...newPdu, host: e.target.value })}
                                    placeholder="e.g., 192.168.1.100"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="pduUser">Username</label>
                                <input
                                    type="text"
                                    id="pduUser"
                                    value={newPdu.user}
                                    onChange={(e) => setNewPdu({ ...newPdu, user: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="pduPasswd">Password</label>
                                <input
                                    type="password"
                                    id="pduPasswd"
                                    value={newPdu.passwd}
                                    onChange={(e) => setNewPdu({ ...newPdu, passwd: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="pduPath">PDU Path</label>
                                <input
                                    type="text"
                                    id="pduPath"
                                    value={newPdu.pduPath}
                                    onChange={(e) => setNewPdu({ ...newPdu, pduPath: e.target.value })}
                                    placeholder="/model/pdu/0"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="cancel-btn"
                                onClick={() => setShowAddPduModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="add-btn"
                                onClick={addNewPdu}
                            >
                                Add PDU
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showEditDeviceModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Edit Device Name</h3>
                            <button
                                className="close-modal"
                                onClick={() => setShowEditDeviceModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="deviceName">Device Name</label>
                                <input
                                    type="text"
                                    id="deviceName"
                                    value={editingOutlet.deviceName}
                                    onChange={(e) => setEditingOutlet({ ...editingOutlet, deviceName: e.target.value })}
                                    placeholder="Enter device name"
                                    required
                                />
                            </div>
                            <p className="outlet-info">
                                PDU: <strong>{editingOutlet.pduName}</strong>,
                                Outlet: <strong>{editingOutlet.outletNumber}</strong>
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="cancel-btn"
                                onClick={() => setShowEditDeviceModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="save-btn"
                                onClick={saveDeviceName}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}




        </div>
    );
};

export default SimpleControlPanel;