const API_BASE = 'http://localhost:3000/api';

let currentBlock = '';
let markers = [];
let selectedCoordinates = null;
let isListView = false;
let allProperties = [];
let currentUser = null;
let viewer = null;
let markerOverlay = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initializeOpenSeadragon();
    initializeDashboard();
    setupEventListeners();
    loadRecentProperties();
    updateStats();
});

function initializeOpenSeadragon() {
    viewer = OpenSeadragon({
        id: "openseadragon-viewer",
        prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.0.0/images/",
        showNavigationControl: true,
        showZoomControl: true,
        showHomeControl: true,
        showFullPageControl: true,
        showSequenceControl: false,
        autoHideControls: false,
        immediateRender: true,
        defaultZoomLevel: 1,
        minZoomLevel: 0.1,
        maxZoomLevel: 20,
        visibilityRatio: 1.0,
        constrainDuringPan: true,
        animationTime: 0.5,
        blendTime: 0.1,
        springStiffness: 5.0,
        gestureSettingsMouse: {
            scrollToZoom: true
        }
    });

    // Create marker overlay
    markerOverlay = document.createElement('div');
    markerOverlay.className = 'marker-overlay';
    viewer.canvas.appendChild(markerOverlay);

    // Add click handler for placing markers
    viewer.addHandler('canvas-click', function(event) {
        if (!currentBlock) {
            alert('Please select a block first.');
            return;
        }

        const webPoint = event.position;
        const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
        
        handleMapClick(viewportPoint.x, viewportPoint.y, webPoint.x, webPoint.y);
    });

    // Update zoom level display
    viewer.addHandler('zoom', function() {
        updateZoomDisplay();
        updateMarkerSizes();
    });

    // Update marker positions on viewport change
    viewer.addHandler('viewport-change', function() {
        updateMarkerPositions();
    });
}

function handleMapClick(normalizedX, normalizedY, pixelX, pixelY) {
    // Check if there's already a marker at this position
    const existingMarker = markers.find(marker => {
        const markerRect = marker.element.getBoundingClientRect();
        const viewerRect = viewer.canvas.getBoundingClientRect();
        const markerX = markerRect.left + markerRect.width / 2;
        const markerY = markerRect.top + markerRect.height / 2;
        
        return Math.abs(markerX - (pixelX + viewerRect.left)) < 20 && 
               Math.abs(markerY - (pixelY + viewerRect.top)) < 20;
    });
    
    if (existingMarker) {
        // Show property details
        showPropertyDetails(existingMarker.propertyId);
        return;
    }
    
    // Open modal to enter property details
    selectedCoordinates = { 
        normalizedX: normalizedX, 
        normalizedY: normalizedY,
        pixelX: pixelX,
        pixelY: pixelY
    };
    document.getElementById('coordinates').value = JSON.stringify({
        x: normalizedX,
        y: normalizedY
    });
    document.getElementById('propertyModal').style.display = 'block';
}

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user) {
        window.location.href = '/';
        return;
    }
    
    currentUser = user;
    document.getElementById('userName').textContent = user.fullname;
    if (user.photo) {
        document.getElementById('userPhoto').src = `/uploads/photos/${user.photo}`;
    } else {
        document.getElementById('userPhoto').src = '/images/default-avatar.jpg';
    }
}

function initializeDashboard() {
    // Set up block selection
    document.getElementById('blockSelect').addEventListener('change', function(e) {
        currentBlock = e.target.value;
        if (currentBlock) {
            loadBlockImage(currentBlock);
            loadPropertiesForBlock(currentBlock);
            document.getElementById('currentBlockTitle').textContent = `Block: ${currentBlock.charAt(0).toUpperCase() + currentBlock.slice(1)}`;
            document.getElementById('noImage').style.display = 'none';
        } else {
            clearViewer();
            document.getElementById('noImage').style.display = 'flex';
            document.getElementById('currentBlockTitle').textContent = 'Select a City Block';
        }
    });
}

function setupEventListeners() {
    // Modal functionality
    const modals = document.querySelectorAll('.modal');
    const closeBtns = document.querySelectorAll('.close');
    
    closeBtns.forEach(btn => {
        btn.onclick = function() {
            modals.forEach(modal => modal.style.display = 'none');
        };
    });
    
    window.onclick = (e) => {
        modals.forEach(modal => {
            if (e.target === modal) modal.style.display = 'none';
        });
    };

    // Property form submission
    document.getElementById('propertyForm').addEventListener('submit', addProperty);

    // Global functions
    window.applyFilters = applyFilters;
    window.clearFilters = clearFilters;
    window.toggleView = toggleView;
    window.logout = logout;
    window.deleteProperty = deleteProperty;
    window.editProperty = editProperty;
    window.toggleVideoPlayback = toggleVideoPlayback;
    window.toggleVideoFullscreen = toggleVideoFullscreen;
    window.zoomToMarkers = zoomToMarkers;
    window.toggleMarkers = toggleMarkers;
}

function loadBlockImage(blockName) {
    const imagePath = `images/${blockName}.jpg`;
    
    // Clear existing image
    viewer.world.removeAll();
    
    // Show loading state
    document.querySelector('.viewer-container').classList.add('loading');
    
    // Create a simple image tile source
    const tileSource = {
        type: 'image',
        url: imagePath,
        buildPyramid: false
    };
    
    // Add new image
    viewer.addTiledImage({
        tileSource: tileSource,
        success: function() {
            console.log('Image loaded successfully');
            document.querySelector('.viewer-container').classList.remove('loading');
            // Fit image to viewport
            viewer.viewport.goHome();
            updateZoomDisplay();
        },
        error: function(event) {
            console.error('Failed to load image:', imagePath, event);
            document.querySelector('.viewer-container').classList.remove('loading');
            alert('Failed to load block image. Please make sure the image file exists at: ' + imagePath);
        }
    });
}

function clearViewer() {
    viewer.world.removeAll();
    clearMarkers();
}

function clearMarkers() {
    markers.forEach(marker => {
        if (marker.element && marker.element.parentNode) {
            marker.element.parentNode.removeChild(marker.element);
        }
    });
    markers = [];
}

function addMarker(normalizedX, normalizedY, type, propertyId) {
    const markerElement = document.createElement('div');
    markerElement.className = `property-marker ${type}`;
    markerElement.title = `Property ${propertyId} (${type})`;
    markerElement.setAttribute('data-property-id', propertyId);
    
    markerOverlay.appendChild(markerElement);
    
    const marker = {
        normalizedX: normalizedX,
        normalizedY: normalizedY,
        type: type,
        propertyId: propertyId,
        element: markerElement
    };
    
    markers.push(marker);
    
    // Position marker
    updateMarkerPosition(marker);
    
    // Add click event
    markerElement.addEventListener('click', function(e) {
        e.stopPropagation();
        showPropertyDetails(propertyId);
    });
    
    return marker;
}

function updateMarkerPosition(marker) {
    const viewportPoint = new OpenSeadragon.Point(marker.normalizedX, marker.normalizedY);
    const pixelPoint = viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);
    
    marker.element.style.left = pixelPoint.x + 'px';
    marker.element.style.top = pixelPoint.y + 'px';
}

function updateMarkerPositions() {
    markers.forEach(marker => {
        updateMarkerPosition(marker);
    });
}

function updateMarkerSizes() {
    const zoom = viewer.viewport.getZoom();
    const baseSize = 16;
    const minSize = 8;
    const maxSize = 32;
    
    // Adjust marker size based on zoom level
    const newSize = Math.max(minSize, Math.min(maxSize, baseSize * zoom));
    
    markers.forEach(marker => {
        marker.element.style.width = newSize + 'px';
        marker.element.style.height = newSize + 'px';
    });
}

function updateZoomDisplay() {
    const zoom = viewer.viewport.getZoom();
    document.getElementById('zoomLevel').textContent = zoom.toFixed(1) + 'x';
}

function zoomToMarkers() {
    if (markers.length === 0) return;
    
    const points = markers.map(marker => 
        new OpenSeadragon.Point(marker.normalizedX, marker.normalizedY)
    );
    
    const bounds = OpenSeadragon.Viewport.getBounds(points);
    
    // Add some padding
    bounds.x -= bounds.width * 0.1;
    bounds.y -= bounds.height * 0.1;
    bounds.width *= 1.2;
    bounds.height *= 1.2;
    
    viewer.viewport.fitBounds(bounds);
}

function toggleMarkers() {
    const isVisible = markerOverlay.style.display !== 'none';
    markerOverlay.style.display = isVisible ? 'none' : 'block';
}

async function addProperty(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('block_name', currentBlock);
    formData.append('property_type', document.getElementById('propertyType').value);
    formData.append('coordinates', document.getElementById('coordinates').value);
    formData.append('measures', document.getElementById('measures').value);
    formData.append('bedrooms', document.getElementById('bedrooms').value);
    formData.append('bathrooms', document.getElementById('bathrooms').value);
    formData.append('kitchens', document.getElementById('kitchens').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('price', document.getElementById('price').value);
    
    const videoFile = document.getElementById('propertyVideo').files[0];
    if (videoFile) {
        formData.append('video', videoFile);
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/properties`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            alert('Property added successfully!');
            document.getElementById('propertyModal').style.display = 'none';
            document.getElementById('propertyForm').reset();
            
            // Reload properties and markers
            loadPropertiesForBlock(currentBlock);
            loadRecentProperties();
            updateStats();
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        alert('Failed to add property. Please try again.');
    }
}

async function loadPropertiesForBlock(blockName) {
    try {
        const response = await fetch(`${API_BASE}/properties?block=${blockName}`);
        if (response.ok) {
            const properties = await response.json();
            
            // Clear existing markers
            clearMarkers();
            
            // Add markers for each property
            properties.forEach(property => {
                const coords = JSON.parse(property.coordinates);
                addMarker(coords.x, coords.y, property.property_type, property.id);
            });
            
            displayProperties(properties);
        }
    } catch (error) {
        console.error('Error loading properties:', error);
    }
}

async function loadRecentProperties() {
    try {
        const response = await fetch(`${API_BASE}/properties/recent`);
        if (response.ok) {
            const properties = await response.json();
            allProperties = properties;
            updateStats();
        }
    } catch (error) {
        console.error('Error loading recent properties:', error);
    }
}

function displayProperties(properties) {
    const container = document.getElementById('propertiesContainer');
    const noProperties = document.getElementById('noProperties');
    
    if (properties.length === 0) {
        container.innerHTML = '';
        container.appendChild(noProperties);
        noProperties.style.display = 'block';
        return;
    }
    
    noProperties.style.display = 'none';
    container.innerHTML = '';
    
    properties.forEach(property => {
        const propertyElement = createPropertyCard(property);
        container.appendChild(propertyElement);
    });
}

function createPropertyCard(property) {
    const propertyElement = document.createElement('div');
    propertyElement.className = `property-card ${isListView ? 'list-view' : ''}`;
    
    const isOwner = currentUser && property.user_id === currentUser.id;
    
    const typeColors = {
        'rent': '#007bff',
        'sell': '#dc3545', 
        'farm': '#ffc107'
    };
    
    propertyElement.innerHTML = `
        <div class="property-image" style="background: linear-gradient(135deg, ${typeColors[property.property_type]}40, ${typeColors[property.property_type]}80)">
            <span class="property-type-badge ${property.property_type}">
                ${property.property_type.toUpperCase()}
            </span>
            <div class="property-price">$${parseFloat(property.price).toLocaleString()}</div>
        </div>
        <div class="property-content">
            <div class="property-header">
                <img src="/uploads/photos/${property.user_photo || 'default-avatar.jpg'}" 
                     alt="${property.fullname}" class="user-avatar">
                <div class="property-basic-info">
                    <h3>${property.block_name} Property</h3>
                    <div class="property-measures">${property.measures}</div>
                </div>
            </div>
            
            <div class="property-details">
                <div class="detail-item">
                    <span class="detail-value">${property.bedrooms || 0}</span>
                    <span class="detail-label">Bedrooms</span>
                </div>
                <div class="detail-item">
                    <span class="detail-value">${property.bathrooms || 0}</span>
                    <span class="detail-label">Bathrooms</span>
                </div>
                <div class="detail-item">
                    <span class="detail-value">${property.kitchens || 0}</span>
                    <span class="detail-label">Kitchens</span>
                </div>
            </div>
            
            <div class="property-description">
                ${property.description || 'No description provided.'}
            </div>
            
            ${isOwner ? `
                <div class="property-card-actions">
                    <button class="edit-btn" onclick="event.stopPropagation(); editProperty(${property.id})">Edit</button>
                    <button class="delete-btn" onclick="event.stopPropagation(); deleteProperty(${property.id})">Delete</button>
                </div>
            ` : ''}
            
            <div class="property-footer">
                <span>Posted by: ${property.fullname}</span>
                <span>${new Date(property.created_at).toLocaleDateString()}</span>
            </div>
        </div>
    `;
    
    propertyElement.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            showPropertyDetails(property.id);
        }
    });
    
    return propertyElement;
}

async function showPropertyDetails(propertyId) {
    try {
        const response = await fetch(`${API_BASE}/properties`);
        if (response.ok) {
            const properties = await response.json();
            const property = properties.find(p => p.id == propertyId);
            
            if (property) {
                const modal = document.getElementById('propertyDetailsModal');
                const content = document.getElementById('propertyDetailsContent');
                
                const isOwner = currentUser && property.user_id === currentUser.id;
                
                content.innerHTML = `
                    <div class="property-details-view">
                        <div class="details-header">
                            <h2>${property.block_name} Property Details</h2>
                            <div class="details-price">$${parseFloat(property.price).toLocaleString()}</div>
                            <span class="property-type-badge ${property.property_type}">
                                ${property.property_type.toUpperCase()}
                            </span>
                        </div>
                        
                        <div class="details-grid">
                            <div class="details-section">
                                <h3>Property Information</h3>
                                <p><strong>Type:</strong> <span class="property-type-badge ${property.property_type}">${property.property_type.toUpperCase()}</span></p>
                                <p><strong>Measures:</strong> ${property.measures}</p>
                                <p><strong>Bedrooms:</strong> ${property.bedrooms || 0}</p>
                                <p><strong>Bathrooms:</strong> ${property.bathrooms || 0}</p>
                                <p><strong>Kitchens:</strong> ${property.kitchens || 0}</p>
                                <p><strong>Price:</strong> $${parseFloat(property.price).toLocaleString()}</p>
                            </div>
                            
                            <div class="details-section">
                                <h3>Description</h3>
                                <p>${property.description || 'No description provided.'}</p>
                            </div>
                            
                            <div class="details-section">
                                <h3>Location</h3>
                                <p><strong>Block:</strong> ${property.block_name}</p>
                                <p><strong>Coordinates:</strong> X: ${JSON.parse(property.coordinates).x.toFixed(3)}, Y: ${JSON.parse(property.coordinates).y.toFixed(3)}</p>
                            </div>
                            
                            <div class="details-section">
                                <h3>Contact Information</h3>
                                <p><strong>Posted by:</strong> ${property.fullname}</p>
                                <p><strong>Date Posted:</strong> ${new Date(property.created_at).toLocaleDateString()}</p>
                                <p><strong>Time:</strong> ${new Date(property.created_at).toLocaleTimeString()}</p>
                            </div>
                        </div>
                        
                        ${property.video_path ? `
                            <div class="video-section">
                                <h3>Property Video</h3>
                                <div class="video-container">
                                    <video id="propertyVideoPlayer" controls>
                                        <source src="/uploads/videos/${property.video_path}" type="video/mp4">
                                        Your browser does not support the video tag.
                                    </video>
                                    <div class="video-controls">
                                        <button onclick="toggleVideoPlayback()">Play/Pause</button>
                                        <button onclick="toggleVideoFullscreen()">Fullscreen</button>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${isOwner ? `
                            <div class="property-actions">
                                <button class="edit-btn" onclick="editProperty(${property.id})">Edit Property</button>
                                <button class="delete-btn" onclick="deleteProperty(${property.id})">Delete Property</button>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                modal.style.display = 'block';
                
                // Initialize video if exists
                if (property.video_path) {
                    initializeVideoPlayer();
                }
            }
        }
    } catch (error) {
        console.error('Error loading property details:', error);
        alert('Failed to load property details.');
    }
}

// Video control functions
function initializeVideoPlayer() {
    const video = document.getElementById('propertyVideoPlayer');
    if (video) {
        video.controls = true;
        video.addEventListener('loadedmetadata', function() {
            console.log('Video duration:', video.duration, 'seconds');
        });
    }
}

function toggleVideoPlayback() {
    const video = document.getElementById('propertyVideoPlayer');
    if (video) {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }
}

function toggleVideoFullscreen() {
    const video = document.getElementById('propertyVideoPlayer');
    if (video) {
        if (!document.fullscreenElement) {
            if (video.requestFullscreen) {
                video.requestFullscreen();
            } else if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
            } else if (video.msRequestFullscreen) {
                video.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }
}

// Delete property function
async function deleteProperty(propertyId) {
    if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/properties/${propertyId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            alert('Property deleted successfully!');
            document.getElementById('propertyDetailsModal').style.display = 'none';
            
            // Reload the properties and markers
            if (currentBlock) {
                loadPropertiesForBlock(currentBlock);
            }
            loadRecentProperties();
            updateStats();
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Error deleting property:', error);
        alert('Failed to delete property. Please try again.');
    }
}

// Edit property function (placeholder for now)
function editProperty(propertyId) {
    alert('Edit functionality coming soon! Property ID: ' + propertyId);
    // You can implement edit functionality similar to the add property form
}

async function applyFilters() {
    const block = document.getElementById('blockSelect').value;
    const type = document.getElementById('typeFilter').value;
    
    let url = `${API_BASE}/properties?`;
    if (block) url += `block=${block}&`;
    if (type) url += `type=${type}`;
    
    try {
        const response = await fetch(url);
        if (response.ok) {
            const properties = await response.json();
            displayProperties(properties);
            
            // Update markers on current block image
            if (block === currentBlock) {
                // Clear existing markers
                clearMarkers();
                
                // Add markers for filtered properties
                properties.forEach(property => {
                    const coords = JSON.parse(property.coordinates);
                    addMarker(coords.x, coords.y, property.property_type, property.id);
                });
            }
        }
    } catch (error) {
        console.error('Error applying filters:', error);
    }
}

function clearFilters() {
    document.getElementById('typeFilter').value = '';
    applyFilters();
}

function toggleView() {
    isListView = !isListView;
    const container = document.getElementById('propertiesContainer');
    const button = document.getElementById('toggleView');
    
    if (isListView) {
        container.classList.add('list-view');
        button.textContent = 'Grid View';
    } else {
        container.classList.remove('list-view');
        button.textContent = 'List View';
    }
}

function updateStats() {
    const total = allProperties.length;
    const rentCount = allProperties.filter(p => p.property_type === 'rent').length;
    const saleCount = allProperties.filter(p => p.property_type === 'sell').length;
    
    document.getElementById('totalProperties').textContent = total;
    document.getElementById('rentCount').textContent = rentCount;
    document.getElementById('saleCount').textContent = saleCount;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Utility function to center on a specific property
function centerOnProperty(propertyId) {
    const property = allProperties.find(p => p.id == propertyId);
    if (property) {
        const coords = JSON.parse(property.coordinates);
        const point = new OpenSeadragon.Point(coords.x, coords.y);
        viewer.viewport.panTo(point);
        viewer.viewport.zoomTo(5); // Zoom in to show details
    }
}

// Highlight a specific property marker
function highlightPropertyMarker(propertyId) {
    markers.forEach(marker => {
        if (marker.propertyId == propertyId) {
            marker.element.style.boxShadow = '0 0 0 3px #00ff00, 0 2px 8px rgba(0, 0, 0, 0.3)';
            marker.element.style.zIndex = '1002';
            marker.element.style.animation = 'pulse 1s infinite';
        } else {
            marker.element.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            marker.element.style.zIndex = '1000';
            marker.element.style.animation = 'none';
        }
    });
}

// Add CSS for pulse animation
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.1); }
        100% { transform: translate(-50%, -50%) scale(1); }
    }
`;
document.head.appendChild(style);

// Make functions globally available
window.centerOnProperty = centerOnProperty;
window.highlightPropertyMarker = highlightPropertyMarker;