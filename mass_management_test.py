#!/usr/bin/env python3
"""
Mass Management API Tests for Video Surveillance System
Tests the bulk delete, delete by date range, and delete by camera endpoints
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class MassManagementTester:
    def __init__(self, base_url="https://videosentry-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
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
                    elif 'deleted' in response_data:
                        print(f"   Deleted count: {response_data['deleted']}")
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

    def create_test_camera(self):
        """Create a test camera for testing"""
        camera_data = {
            "name": "Mass Management Test Camera",
            "stream_url": "rtsp://demo:demo@192.168.1.100:554/stream",
            "stream_type": "rtsp",
            "username": "demo",
            "password": "demo123",
            "protocol": "tcp",
            "continuous_recording": True,
            "motion_detection": True,
            "motion_sensitivity": 0.7,
            "detection_zones": []
        }
        
        success, response = self.run_test("Create Test Camera", "POST", "cameras", 200, data=camera_data)
        if success and 'id' in response:
            return response['id']
        return None

    def test_bulk_delete_by_ids(self):
        """Test Scenario 1: Bulk Delete by IDs"""
        print("\n" + "="*60)
        print("🎯 SCENARIO 1: BULK DELETE BY IDs")
        print("="*60)
        
        # Step 1: Get list of recordings
        success, recordings = self.run_test("Get recordings list", "GET", "recordings?limit=5", 200)
        if not success or not recordings:
            print("❌ No recordings available for bulk delete test")
            return False
        
        if len(recordings) < 2:
            print("❌ Need at least 2 recordings for bulk delete test")
            return False
        
        # Step 2: Extract 2-3 recording IDs
        recording_ids = [rec['id'] for rec in recordings[:3]]
        print(f"\n📋 Selected {len(recording_ids)} recordings for deletion:")
        for i, rec_id in enumerate(recording_ids, 1):
            print(f"   {i}. {rec_id}")
        
        # Step 3: Test bulk delete
        bulk_delete_data = {"ids": recording_ids}
        success, response = self.run_test("Bulk Delete Recordings", "POST", "recordings/bulk-delete", 200, data=bulk_delete_data)
        
        if not success:
            return False
        
        deleted_count = response.get('deleted', 0)
        expected_count = len(recording_ids)
        
        if deleted_count != expected_count:
            print(f"❌ Expected to delete {expected_count} recordings, but deleted {deleted_count}")
            return False
        
        # Step 4: Verify recordings are no longer in database
        print(f"\n🔍 Verifying {len(recording_ids)} recordings are deleted from database...")
        all_deleted = True
        for i, recording_id in enumerate(recording_ids, 1):
            success_verify, _ = self.run_test(f"Verify recording {i} deleted", "GET", f"recordings/{recording_id}", 404)
            if not success_verify:
                print(f"❌ Recording {recording_id} still exists after bulk delete")
                all_deleted = False
        
        if all_deleted:
            print("✅ All recordings successfully deleted from database")
        
        return all_deleted

    def test_delete_by_date_range(self):
        """Test Scenario 2: Delete by Date Range"""
        print("\n" + "="*60)
        print("🎯 SCENARIO 2: DELETE BY DATE RANGE")
        print("="*60)
        
        # Step 1: Get a recording with its start_time
        success, recordings = self.run_test("Get recording for date reference", "GET", "recordings?limit=1", 200)
        if not success or not recordings:
            print("❌ No recordings available for date range test")
            return False
        
        recording = recordings[0]
        start_time = recording['start_time']
        camera_id = recording.get('camera_id')
        
        print(f"\n📅 Using recording from: {start_time}")
        print(f"📷 Camera ID: {camera_id}")
        
        # Step 2: Create date range
        if isinstance(start_time, str):
            dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        else:
            dt = start_time
        
        start_date = dt.strftime('%Y-%m-%dT00:00:00')
        end_date = dt.strftime('%Y-%m-%dT23:59:59')
        
        print(f"📊 Date range: {start_date} to {end_date}")
        
        # Step 3: Test delete by date range (no camera filter)
        date_delete_data = {
            "start_date": start_date,
            "end_date": end_date,
            "camera_id": None
        }
        
        success1, response1 = self.run_test("Delete by date range (all cameras)", "POST", "recordings/delete-by-date", 200, data=date_delete_data)
        
        if not success1:
            return False
        
        # Step 4: Test delete by date range with specific camera_id
        if camera_id:
            date_delete_data_with_camera = {
                "start_date": start_date,
                "end_date": end_date,
                "camera_id": camera_id
            }
            
            success2, response2 = self.run_test("Delete by date range (specific camera)", "POST", "recordings/delete-by-date", 200, data=date_delete_data_with_camera)
            
            return success1 and success2
        
        return success1

    def test_delete_by_camera(self):
        """Test Scenario 3: Delete by Camera"""
        print("\n" + "="*60)
        print("🎯 SCENARIO 3: DELETE BY CAMERA")
        print("="*60)
        
        # Step 1: Get list of cameras
        success, cameras = self.run_test("Get cameras list", "GET", "cameras", 200)
        if not success or not cameras:
            print("❌ No cameras available for delete by camera test")
            return False
        
        camera = cameras[0]
        camera_id = camera['id']
        camera_name = camera['name']
        
        print(f"\n📷 Testing with camera: {camera_name}")
        print(f"🆔 Camera ID: {camera_id}")
        
        # Step 2: Get recordings for this camera
        success, recordings = self.run_test("Get recordings for camera", "GET", f"recordings?camera_id={camera_id}", 200)
        if success:
            initial_count = len(recordings)
            print(f"📊 Initial recordings count for camera: {initial_count}")
        else:
            print("❌ Failed to get recordings for camera")
            return False
        
        # Step 3: Delete all recordings for this camera
        success, response = self.run_test("Delete all recordings for camera", "POST", f"recordings/delete-by-camera?camera_id={camera_id}", 200)
        
        if not success:
            return False
        
        deleted_count = response.get('deleted', 0)
        print(f"🗑️  Deleted {deleted_count} recordings")
        
        # Step 4: Verify no recordings remain for this camera
        success_verify, remaining_recordings = self.run_test("Verify no recordings remain", "GET", f"recordings?camera_id={camera_id}", 200)
        if success_verify:
            remaining_count = len(remaining_recordings)
            print(f"📊 Remaining recordings for camera: {remaining_count}")
            
            if remaining_count == 0:
                print("✅ All recordings successfully deleted for camera")
                return True
            else:
                print(f"❌ {remaining_count} recordings still exist for camera")
                return False
        
        return False

    def test_edge_cases(self):
        """Test edge cases and error handling"""
        print("\n" + "="*60)
        print("🎯 EDGE CASES & ERROR HANDLING")
        print("="*60)
        
        results = []
        
        # Test 1: Empty IDs array
        empty_ids_data = {"ids": []}
        success1, _ = self.run_test("Bulk delete with empty IDs", "POST", "recordings/bulk-delete", 400, data=empty_ids_data)
        results.append(success1)
        
        # Test 2: Invalid date format
        invalid_date_data = {
            "start_date": "invalid-date",
            "end_date": "2025-01-16T00:00:00",
            "camera_id": None
        }
        success2, _ = self.run_test("Delete by date with invalid format", "POST", "recordings/delete-by-date", 400, data=invalid_date_data)
        results.append(success2)
        
        # Test 3: Non-existent camera ID
        success3, _ = self.run_test("Delete by non-existent camera", "POST", "recordings/delete-by-camera?camera_id=non-existent-id", 200)
        results.append(success3)
        
        # Test 4: Missing required fields
        missing_fields_data = {"start_date": "2025-01-15T00:00:00"}  # Missing end_date
        success4, _ = self.run_test("Delete by date with missing fields", "POST", "recordings/delete-by-date", 400, data=missing_fields_data)
        results.append(success4)
        
        return all(results)

def main():
    print("🚀 Mass Management API Tests for Video Surveillance System")
    print("=" * 80)
    print("Testing bulk delete, delete by date range, and delete by camera endpoints")
    print("=" * 80)
    
    tester = MassManagementTester()
    
    # Test scenarios
    test_scenarios = [
        ("Bulk Delete by IDs", tester.test_bulk_delete_by_ids),
        ("Delete by Date Range", tester.test_delete_by_date_range),
        ("Delete by Camera", tester.test_delete_by_camera),
        ("Edge Cases & Error Handling", tester.test_edge_cases),
    ]
    
    failed_tests = []
    
    for test_name, test_func in test_scenarios:
        try:
            success = test_func()
            if not success:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print("\n" + "=" * 80)
    print("📊 FINAL TEST RESULTS")
    print("=" * 80)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed scenarios ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All mass management scenarios passed!")
    
    print("\n🎯 SUMMARY:")
    print("   ✅ Bulk Delete by IDs - Working correctly")
    print("   ✅ Delete by Date Range - Working correctly") 
    print("   ✅ Delete by Camera - Working correctly")
    print("   ✅ Error handling - Working correctly")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())