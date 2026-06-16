use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use super::types::PeerInfo;

const SERVICE_TYPE: &str = "_enveil._tcp.local.";

pub struct Mdnssd {
    daemon: Option<ServiceDaemon>,
    peers: Arc<Mutex<HashMap<String, PeerInfo>>>,
    device_name: String,
    port: u16,
}

impl Mdnssd {
    pub fn new(peers: Arc<Mutex<HashMap<String, PeerInfo>>>, device_name: String, port: u16) -> Self {
        Mdnssd {
            daemon: None,
            peers,
            device_name,
            port,
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        let daemon = ServiceDaemon::new().map_err(|e| format!("Failed to start mDNS daemon: {}", e))?;

        let hostname = format!("{}.local.", self.device_name);
        let service_info = ServiceInfo::new(
            SERVICE_TYPE,
            &self.device_name,
            &hostname,
            "",
            self.port,
            None,
        )
        .map_err(|e| format!("Failed to create service info: {}", e))?;

        daemon
            .register(service_info)
            .map_err(|e| format!("Failed to register mDNS service: {}", e))?;

        let peers_clone = Arc::clone(&self.peers);
        let receiver = daemon
            .browse(SERVICE_TYPE)
            .map_err(|e| format!("Failed to browse mDNS: {}", e))?;

        std::thread::spawn(move || {
            for event in receiver {
                match event {
                    ServiceEvent::ServiceResolved(info) => {
                        let device_name = info.get_fullname().split('.').next().unwrap_or("unknown").to_string();
                        let ip = info
                            .get_addresses()
                            .iter()
                            .next()
                            .map(|a| a.to_string())
                            .unwrap_or_default();
                        let port = info.get_port();

                        let peer = PeerInfo {
                            device_name: device_name.clone(),
                            ip,
                            port,
                            hostname: info.get_hostname().to_string(),
                        };

                        let mut peers = peers_clone.lock().unwrap();
                        peers.insert(device_name, peer);
                    }
                    ServiceEvent::ServiceRemoved(_service_type, full_name) => {
                        let device_name = full_name.split('.').next().unwrap_or("unknown").to_string();
                        let mut peers = peers_clone.lock().unwrap();
                        peers.remove(&device_name);
                    }
                    ServiceEvent::SearchStarted(_) | ServiceEvent::SearchStopped(_) => {}
                    _ => {}
                }
            }
        });

        self.daemon = Some(daemon);
        Ok(())
    }
}
