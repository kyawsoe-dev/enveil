use std::net::ToSocketAddrs;

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

    /// Resolve hostname to IPv4 address via system DNS/mDNS (fallback when
    /// mdns-sd's cache returns no addresses due to case-sensitivity bug in v0.12.0).
    fn resolve_hostname(hostname: &str) -> Option<String> {
        let lookup = format!("{}:0", hostname.trim_end_matches('.'));
        if let Ok(mut addrs) = lookup.to_socket_addrs() {
            if let Some(addr) = addrs.find(|a| a.is_ipv4()) {
                let ip = addr.ip().to_string();
                eprintln!("[enveil] resolve_hostname fallback: {} -> {}", hostname, ip);
                return Some(ip);
            }
        }
        eprintln!("[enveil] resolve_hostname fallback: {} -> no IPv4", hostname);
        None
    }

    pub fn start(&mut self) -> Result<(), String> {
        let daemon = ServiceDaemon::new().map_err(|e| format!("Failed to start mDNS daemon: {}", e))?;

        // Use LOWERCASE hostname to work around mdns-sd v0.12.0 case-sensitive
        // cache lookup bug (fixed in v0.13.5).
        let hostname = format!("{}.local.", self.device_name.replace(' ', "-").to_lowercase());
        eprintln!("[enveil] Registering mDNS: name={}, hostname={}, port={}",
            self.device_name, hostname, self.port);

        let service_info = ServiceInfo::new(
            SERVICE_TYPE,
            &self.device_name,
            &hostname,
            "",
            self.port,
            &[] as &[(&str, &str)],
        )
        .map_err(|e| format!("Failed to create service info: {}", e))?
        .enable_addr_auto();

        daemon
            .register(service_info)
            .map_err(|e| format!("Failed to register mDNS service: {}", e))?;

        let peers_clone = Arc::clone(&self.peers);
        let own_name = self.device_name.clone();
        let receiver = daemon
            .browse(SERVICE_TYPE)
            .map_err(|e| format!("Failed to browse mDNS: {}", e))?;

        std::thread::spawn(move || {
            for event in receiver {
                match event {
                    ServiceEvent::ServiceResolved(info) => {
                        let device_name = info.get_fullname().split('.').next().unwrap_or("unknown").to_string();
                        if device_name == own_name {
                            eprintln!("[enveil] Skipping own service: {}", device_name);
                            continue;
                        }

                        let hostname = info.get_hostname().to_string();
                        let port = info.get_port();

                        // Try addresses from mdns-sd cache first.
                        // Prefer non-loopback IPv4 — the HashSet order is arbitrary
                        // and 127.0.0.1 may appear before the LAN IP.
                        let ip = info
                            .get_addresses()
                            .iter()
                            .filter(|a| a.is_ipv4() && !a.is_loopback())
                            .next()
                            .map(|a| a.to_string())
                            .or_else(|| {
                                // Fallback: accept loopback if that's all we have
                                info.get_addresses()
                                    .iter()
                                    .filter(|a| a.is_ipv4())
                                    .next()
                                    .map(|a| a.to_string())
                            })
                            // Final fallback: resolve hostname via system DNS/mDNS
                            .or_else(|| Self::resolve_hostname(&hostname))
                            .unwrap_or_default();

                        eprintln!("[enveil] Resolved peer: name={}, ip={}, port={}, hostname={}",
                            device_name, ip, port, hostname);

                        if ip.is_empty() {
                            eprintln!("[enveil] WARNING: no IP address for peer {}", device_name);
                        }

                        let peer = PeerInfo {
                            device_name: device_name.clone(),
                            ip,
                            port,
                            hostname,
                        };

                        let mut peers = peers_clone.lock().unwrap();
                        peers.insert(device_name, peer);
                    }
                    ServiceEvent::ServiceRemoved(_service_type, full_name) => {
                        let device_name = full_name.split('.').next().unwrap_or("unknown").to_string();
                        eprintln!("[enveil] Service removed: {}", device_name);
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
