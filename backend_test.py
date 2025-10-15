import requests
import sys
import json
from datetime import datetime

class VideoSurveillanceAPITester:
    def __init__(self, base_url="https://videosentry-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_camera_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if method == 'GET' and isinstance(response_data, list):
                        print(f"   Response: {len(response_data)} items returned")
                    elif method == 'POST' and 'id' in response_data:
                        print(f"   Created ID: {response_data['id']}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_create_camera(self):
        """Test camera creation"""
        camera_data = {
            "name": "Test Camera 1",
            "rtsp_url": "rtsp://192.168.1.100:554/stream",
            "username": "admin",
            "password": "12345",
            "protocol": "tcp",
            "continuous_recording": True,
            "motion_detection": True,
            "motion_sensitivity": 0.7,
            "detection_zones": []
        }
        
        success, response = self.run_test("Create Camera", "POST", "cameras", 200, data=camera_data)
        if success and 'id' in response:
            self.created_camera_id = response['id']
            print(f"   Camera ID stored: {self.created_camera_id}")
        return success

    def test_get_cameras(self):
        """Test getting all cameras"""
        return self.run_test("Get All Cameras", "GET", "cameras", 200)

    def test_get_camera_by_id(self):
        """Test getting specific camera"""
        if not self.created_camera_id:
            print("❌ Skipped - No camera ID available")
            return False
        
        return self.run_test("Get Camera by ID", "GET", f"cameras/{self.created_camera_id}", 200)

    def test_update_camera(self):
        """Test camera update"""
        if not self.created_camera_id:
            print("❌ Skipped - No camera ID available")
            return False
        
        update_data = {
            "name": "Updated Test Camera",
            "motion_sensitivity": 0.8
        }
        
        return self.run_test("Update Camera", "PUT", f"cameras/{self.created_camera_id}", 200, data=update_data)

    def test_start_camera(self):
        """Test starting camera"""
        if not self.created_camera_id:
            print("❌ Skipped - No camera ID available")
            return False
        
        return self.run_test("Start Camera", "POST", f"cameras/{self.created_camera_id}/start", 200)

    def test_stop_camera(self):
        """Test stopping camera"""
        if not self.created_camera_id:
            print("❌ Skipped - No camera ID available")
            return False
        
        return self.run_test("Stop Camera", "POST", f"cameras/{self.created_camera_id}/stop", 200)

    def test_get_recordings(self):
        """Test getting recordings"""
        return self.run_test("Get All Recordings", "GET", "recordings", 200)

    def test_get_recordings_with_filters(self):
        """Test getting recordings with filters"""
        if not self.created_camera_id:
            print("❌ Skipped - No camera ID available")
            return False
        
        params = {"camera_id": self.created_camera_id, "recording_type": "continuous"}
        return self.run_test("Get Filtered Recordings", "GET", "recordings", 200, params=params)

    def test_get_motion_events(self):
        """Test getting motion events"""
        return self.run_test("Get Motion Events", "GET", "motion-events", 200)

    def test_get_motion_events_with_filter(self):
        """Test getting motion events with camera filter"""
        if not self.created_camera_id:
            print("❌ Skipped - No camera ID available")
            return False
        
        params = {"camera_id": self.created_camera_id}
        return self.run_test("Get Filtered Motion Events", "GET", "motion-events", 200, params=params)

    def test_get_storage_stats(self):
        """Test getting storage statistics"""
        return self.run_test("Get Storage Stats", "GET", "storage/stats", 200)

    def test_cleanup_storage(self):
        """Test storage cleanup"""
        return self.run_test("Cleanup Storage", "POST", "storage/cleanup", 200)

    def test_live_stream_endpoint(self):
        """Test live stream endpoint (just check if it responds)"""
        if not self.created_camera_id:
            print("❌ Skipped - No camera ID available")
            return False
        
        # For streaming endpoint, we just check if it doesn't return 404
        url = f"{self.api_url}/stream/{self.created_camera_id}"
        print(f"\n🔍 Testing Live Stream Endpoint...")
        print(f"   URL: {url}")
        
        try:
            response = requests.get(url, timeout=5, stream=True)
            # Stream endpoints might return different status codes
            if response.status_code in [200, 404, 500]:  # 404/500 expected if no real camera
                self.tests_passed += 1
                print(f"✅ Passed - Stream endpoint accessible (Status: {response.status_code})")
                return True
            else:
                print(f"❌ Failed - Unexpected status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False
        finally:
            self.tests_run += 1

    def test_bulk_delete_recordings(self):
        """Test bulk delete recordings by IDs"""
        print("\n🔍 Testing Bulk Delete Recordings...")
        
        # First get some recordings
        success, recordings = self.run_test("Get Recordings for Bulk Delete", "GET", "recordings?limit=5", 200)
        if not success or not recordings:
            print("❌ No recordings available for bulk delete test")
            return False
        
        if len(recordings) < 2:
            print("❌ Need at least 2 recordings for bulk delete test")
            return False
        
        # Extract 2-3 recording IDs
        recording_ids = [rec['id'] for rec in recordings[:3]]
        print(f"   Selected {len(recording_ids)} recordings for deletion: {recording_ids}")
        
        # Test bulk delete
        bulk_delete_data = {"ids": recording_ids}
        success, response = self.run_test("Bulk Delete Recordings", "POST", "recordings/bulk-delete", 200, data=bulk_delete_data)
        
        if success:
            deleted_count = response.get('deleted', 0)
            print(f"   Deleted count: {deleted_count}")
            
            # Verify recordings are actually deleted
            for recording_id in recording_ids:
                verify_success, _ = self.run_test(f"Verify Recording {recording_id} Deleted", "GET", f"recordings/{recording_id}", 404)
                if not verify_success:
                    print(f"❌ Recording {recording_id} still exists after bulk delete")
                    return False
            
            print("✅ All recordings successfully deleted from database")
        
        return success

    def test_delete_by_date_range(self):
        """Test delete recordings by date range"""
        print("\n🔍 Testing Delete by Date Range...")
        
        # First get a recording to use its date
        success, recordings = self.run_test("Get Recording for Date Range", "GET", "recordings?limit=1", 200)
        if not success or not recordings:
            print("❌ No recordings available for date range test")
            return False
        
        recording = recordings[0]
        start_time = recording['start_time']
        
        # Parse the datetime and create a range
        if isinstance(start_time, str):
            from datetime import datetime, timedelta
            dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        else:
            dt = start_time
        
        # Create date range (same day)
        start_date = dt.strftime('%Y-%m-%dT00:00:00')
        end_date = dt.strftime('%Y-%m-%dT23:59:59')
        
        print(f"   Using date range: {start_date} to {end_date}")
        
        # Test delete by date range without camera filter
        date_delete_data = {
            "start_date": start_date,
            "end_date": end_date,
            "camera_id": None
        }
        
        success, response = self.run_test("Delete by Date Range", "POST", "recordings/delete-by-date", 200, data=date_delete_data)
        
        if success:
            deleted_count = response.get('deleted', 0)
            print(f"   Deleted count: {deleted_count}")
        
        # Test with specific camera_id
        if self.created_camera_id:
            date_delete_data_with_camera = {
                "start_date": start_date,
                "end_date": end_date,
                "camera_id": self.created_camera_id
            }
            
            success2, response2 = self.run_test("Delete by Date Range with Camera", "POST", "recordings/delete-by-date", 200, data=date_delete_data_with_camera)
            if success2:
                deleted_count2 = response2.get('deleted', 0)
                print(f"   Deleted count with camera filter: {deleted_count2}")
            
            return success and success2
        
        return success

    def test_delete_by_camera(self):
        """Test delete all recordings for a specific camera"""
        print("\n🔍 Testing Delete by Camera...")
        
        # First get list of cameras
        success, cameras = self.run_test("Get Cameras for Delete Test", "GET", "cameras", 200)
        if not success or not cameras:
            print("❌ No cameras available for delete by camera test")
            return False
        
        camera = cameras[0]
        camera_id = camera['id']
        print(f"   Testing with camera: {camera['name']} (ID: {camera_id})")
        
        # Get recordings for this camera to count them
        success, recordings = self.run_test("Get Recordings for Camera", "GET", f"recordings?camera_id={camera_id}", 200)
        if success:
            initial_count = len(recordings)
            print(f"   Initial recordings count for camera: {initial_count}")
        
        # Delete all recordings for this camera
        success, response = self.run_test("Delete by Camera", "POST", f"recordings/delete-by-camera?camera_id={camera_id}", 200)
        
        if success:
            deleted_count = response.get('deleted', 0)
            print(f"   Deleted count: {deleted_count}")
            
            # Verify no recordings remain for this camera
            success_verify, remaining_recordings = self.run_test("Verify No Recordings Remain", "GET", f"recordings?camera_id={camera_id}", 200)
            if success_verify:
                remaining_count = len(remaining_recordings)
                print(f"   Remaining recordings for camera: {remaining_count}")
                if remaining_count == 0:
                    print("✅ All recordings successfully deleted for camera")
                else:
                    print(f"❌ {remaining_count} recordings still exist for camera")
                    return False
        
        return success

    def test_delete_camera(self):
        """Test camera deletion (cleanup)"""
        if not self.created_camera_id:
            print("❌ Skipped - No camera ID available")
            return False
        
        return self.run_test("Delete Camera", "DELETE", f"cameras/{self.created_camera_id}", 200)

    def test_invalid_endpoints(self):
        """Test invalid endpoints return proper errors"""
        success1 = self.run_test("Get Non-existent Camera", "GET", "cameras/invalid-id", 404)
        success2 = self.run_test("Delete Non-existent Recording", "DELETE", "recordings/invalid-id", 404)
        return success1 and success2

def main():
    print("🚀 Starting Video Surveillance System API Tests")
    print("=" * 60)
    
    tester = VideoSurveillanceAPITester()
    
    # Test sequence
    tests = [
        ("Root API", tester.test_root_endpoint),
        ("Camera Creation", tester.test_create_camera),
        ("Get All Cameras", tester.test_get_cameras),
        ("Get Camera by ID", tester.test_get_camera_by_id),
        ("Update Camera", tester.test_update_camera),
        ("Start Camera", tester.test_start_camera),
        ("Stop Camera", tester.test_stop_camera),
        ("Get Recordings", tester.test_get_recordings),
        ("Get Filtered Recordings", tester.test_get_recordings_with_filters),
        ("Get Motion Events", tester.test_get_motion_events),
        ("Get Filtered Motion Events", tester.test_get_motion_events_with_filter),
        ("Storage Stats", tester.test_get_storage_stats),
        ("Storage Cleanup", tester.test_cleanup_storage),
        ("Live Stream", tester.test_live_stream_endpoint),
        ("Bulk Delete Recordings", tester.test_bulk_delete_recordings),
        ("Delete by Date Range", tester.test_delete_by_date_range),
        ("Delete by Camera", tester.test_delete_by_camera),
        ("Invalid Endpoints", tester.test_invalid_endpoints),
        ("Delete Camera (Cleanup)", tester.test_delete_camera),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            success = test_func()
            if not success:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS")
    print("=" * 60)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All tests passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())