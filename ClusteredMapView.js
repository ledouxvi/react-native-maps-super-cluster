'use-strict'

// base libs
import PropTypes from 'prop-types'
import React, { Component } from 'react'
import {
  Platform,
  Dimensions,
  LayoutAnimation,
  View,
  Image,
} from 'react-native';
// map-related libs
import MapView, { Marker } from 'react-native-maps';
import SuperCluster from 'supercluster'
import GeoViewport from '@mapbox/geo-viewport'
// components / views
import ClusterMarker from './ClusterMarker'
// libs / utils
import {
  regionToBoundingBox,
  itemToGeoJSONFeature
} from './util'
import isEqual from 'lodash.isequal';
import GeolocationHelper from '../../src/helpers/geolocation';
import colors from '../../src/helpers/color';

export default class ClusteredMapView extends Component {


  ungroupLines = [];
  groupCenter = [];
  exploded = [];

  constructor(props) {
    super(props)

    this.state = {
      data: [], // helds renderable clusters and markers
      region: props.region || props.initialRegion, // helds current map region
    }
    this.zoom = 1;
    this.isAndroid = Platform.OS === 'android'
    this.dimensions = [props.width, props.height]

    this.mapRef = this.mapRef.bind(this)
    this.onClusterPress = this.onClusterPress.bind(this)
    this.onRegionChangeComplete = this.onRegionChangeComplete.bind(this)
  }

  componentDidMount() {
    this.clusterize(this.props.data)
  }

  shouldComponentUpdate(nextProps, nextState)
  {
    const nextData = this.getClusters(nextState.region);
    return !isEqual(nextData, this.state.data) || this.props.children !== nextProps.children;
  }

  componentWillReceiveProps(nextProps) {
    if (!isEqual(this.props.data, nextProps.data))
    {

      ungroupLines = [];
      groupCenter = [];
      this.clusterize(nextProps.data)
    }
    /*if (this.props.data !== nextProps.data)
      this.clusterize(nextProps.data)*/
  }

  componentWillUpdate(nextProps, nextState) {
    if (!this.isAndroid && this.props.animateClusters && this.clustersChanged(nextState))
      LayoutAnimation.configureNext(this.props.layoutAnimationConf)
  }

  mapRef = (ref) => {
    this.mapview = ref
  }

  getMapRef = () => this.mapview

  getClusteringEngine = () => this.index

  getZoom = () => this.zoom

  clusterize = (dataset) => {
    this.index = new SuperCluster({ // eslint-disable-line new-cap
      extent: this.props.extent,
      minZoom: this.props.minZoom,
      maxZoom: this.props.maxZoom,
      radius: this.props.radius || (this.dimensions[0] * .045), // 4.5% of screen width
    })

    // get formatted GeoPoints for cluster
    const rawData = dataset.map(itemToGeoJSONFeature)

    // load geopoints into SuperCluster
    this.index.load(rawData)

    const data = this.getClusters(this.state.region)
    this.setState({ data })
  }

  clustersChanged = (nextState) => this.state.data.length !== nextState.data.length

  onRegionChangeComplete = (region) => {
    var data = this.getClusters(region)


    //console.warn(data);
    if (!isEqual(data, this.state.data)) {
      data = this.unexplode(data, region);
      return this.setState({ region, data }, () => {
        this.props.onRegionChangeComplete && this.props.onRegionChangeComplete(region, data)
      })
    }

    this.props.onRegionChangeComplete && this.props.onRegionChangeComplete(region, data)
  }

  unexplode = (data, region) =>
  {
    if(this.exploded.length > 0)
    {
      let dataset = this.props.data.map((item) =>
      {
        for (var i = 0; i < this.exploded.length; i++)
        {
          let explodedItem = this.exploded[i];

          if (explodedItem.id === item.id)
          {
            item.latitude = explodedItem.latitude;
            item.longitude = explodedItem.longitude;

          }
        }

        return item;
      });

      this.ungroupLines = [];
      this.groupCenter = [];

      this.index = new SuperCluster({ // eslint-disable-line new-cap
        extent: this.props.extent,
        minZoom: this.props.minZoom,
        maxZoom: this.props.maxZoom,
        radius: this.props.radius || (this.dimensions[0] * .045), // 4.5% of screen width
      })

      // get formatted GeoPoints for cluster
      const rawData = dataset.map(itemToGeoJSONFeature)

      // load geopoints into SuperCluster
      this.index.load(rawData)

      return this.getClusters(region);
    }

    return data;
  }

  explode = (children) =>
  {
    let dataset = this.props.data;
    let newArray = []
    dataset = dataset.map((item) =>
    {
      //console.warn("check", item);
      const angle = 360 / children.length;
      for(var i = 0; i < children.length; i++)
      {
        let childrenItem = children[i].properties.item;
        //console.warn("childrenItem", childrenItem);
        if (childrenItem.id === item.id)
        {
          // console.warn("update", childrenItem.id);
          /* if (i % 2 === 0)
		   {*/
          this.exploded.push({
            id: childrenItem.id,
            latitude: childrenItem.latitude,
            longitude: childrenItem.longitude,
          })
          let newLocation = this._getDestinationFromDistance(Number(childrenItem.latitude), Number(childrenItem.longitude), 5, angle * i - 90);
          //item.latitude  = '' + (Number(childrenItem.latitude) + ((0.1) / 2000));
          //item.longitude = '' + (Number(childrenItem.longitude) + ((0.1) / 2000));
          newArray.push({
            id: childrenItem.id,
            ...newLocation,
          });
          item.latitude = '' + newLocation.latitude;
          item.longitude = '' + newLocation.longitude;
          /* }
		   else
		   {
			 item.latitude  = '' + (Number(childrenItem.latitude) - ((0.1) / 2000));
			 item.longitude = '' + (Number(childrenItem.longitude) - ((0.1) / 2000));
		   }*/

        }
      }

      return item;
    });


    let contentLocation = newArray;

    let centerLocation = {
      latitude: parseFloat(children[0].geometry.coordinates[1]),
      longitude: parseFloat(children[0].geometry.coordinates[0]),
    };
    this.groupCenter.push(centerLocation);
    contentLocation.push(centerLocation);
    contentLocation.map((location) =>
    {
      this.ungroupLines.push([centerLocation, location]);
    });

    this.index = new SuperCluster({ // eslint-disable-line new-cap
      extent: this.props.extent,
      minZoom: this.props.minZoom,
      maxZoom: this.props.maxZoom,
      radius: this.props.radius || (this.dimensions[0] * .045), // 4.5% of screen width
    })

    // get formatted GeoPoints for cluster
    const rawData = dataset.map(itemToGeoJSONFeature)

    // load geopoints into SuperCluster
    this.index.load(rawData)

    const data = this.getClusters(this.state.region);

    //console.warn(data);
    this.setState({ data });

  }

  getClusters = (region) => {
    const bbox = regionToBoundingBox(region),
        viewport = (region.longitudeDelta) >= 40 ? { zoom: this.props.minZoom } : GeoViewport.viewport(bbox, this.dimensions)
    this.zoom = viewport.zoom;
    return this.index.getClusters(bbox, viewport.zoom)
  }

  _onRegionChange = (region) =>
  {
    this.props.onRegionChange && this.props.onRegionChange(region)
  }

  _getDestinationFromDistance = (initialLat, initialLng, distance, bearing) =>
  {
    //console.warn('distance', distance);
    const radiusEarth = 6378.1;
    const bearingRad = GeolocationHelper._toRad(bearing);
    const distanceKm = distance / 1000;

    //console.warn("bearingRad",bearingRad);
    const lat1 = GeolocationHelper._toRad(initialLat); //Current lat point converted to radians
    const lon1 = GeolocationHelper._toRad(initialLng); //Current long point converted to radians

    let lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(distanceKm / radiusEarth)
        +
        Math.cos(lat1) * Math.sin(distanceKm / radiusEarth) * Math.cos(bearingRad)
    );

    let lon2 = lon1
        +
        Math.atan2(
            Math.sin(bearingRad) * Math.sin(distanceKm / radiusEarth) * Math.cos(lat1),
            Math.cos(distanceKm / radiusEarth) - Math.sin(lat1) * Math.sin(lat2)
        );

    lat2 = GeolocationHelper._toDeg(lat2);
    lon2 = GeolocationHelper._toDeg(lon2);

    //console.warn(initialLat,lat2);
    //console.warn(initialLng,lon2);
    return {
      latitude: lat2,
      longitude: lon2,
    }

  };

  onClusterPress = (cluster) => {

    // cluster press behavior might be extremely custom.
    //console.log("cluster Onpress start", this.props.preserveClusterPressBehavior);
    if (!this.props.preserveClusterPressBehavior) {
      // console.log("cluster Onpress start");
      this.props.onClusterPress && this.props.onClusterPress(cluster.properties.cluster_id)
      return
    }

    // //////////////////////////////////////////////////////////////////////////////////
    // NEW IMPLEMENTATION (with fitToCoordinates)
    // //////////////////////////////////////////////////////////////////////////////////
    // get cluster children
    //console.log("cluster Onpress fitToCoordinates");
    const children = this.index.getLeaves(cluster.properties.cluster_id, this.props.clusterPressMaxChildren),
        markers = children.map(c => c.properties.item)

    // fit right around them, considering edge padding
    this.mapview.fitToCoordinates(markers.map(m => m.location), { edgePadding: this.props.edgePadding })

    this.props.onClusterPress && this.props.onClusterPress(cluster.properties.cluster_id, markers)
  }

  render() {
    //console.log('renderMap');

    return (
        <MapView
            { ...this.props}
            ref={this.mapRef}
            onRegionChange={this._onRegionChange}
            onRegionChangeComplete={this.onRegionChangeComplete}>
          {
            this.props.clusteringEnabled && this.state.data.map((d) => {
              if (d.properties.point_count === 0)
                return this.props.renderMarker(d.properties.item)


              if(this.props.renderCluster)
              {
                //console.log('properties',d);


                const pointCount = d.properties.point_count // eslint-disable-line camelcase
                const latitude = d.geometry.coordinates[1],
                    longitude = d.geometry.coordinates[0]
                const cluster = {
                  pointCount,
                  coordinate: { latitude, longitude },
                  clusterId: d.properties.cluster_id,
                }/*
              return this.props.renderCluster({
                longitude: d.geometry.coordinates[0],
                latitude: d.geometry.coordinates[1],
                abos_count: 0,
                baskets_count: 1,
                id: d.properties.cluster_id,
              });*/
                return this.props.renderCluster(cluster)
              }

              return (
                  <ClusterMarker
                      {...d}
                      onPress={this.onClusterPress}
                      textStyle={this.props.textStyle}
                      scaleUpRatio={this.props.scaleUpRatio}
                      renderCluster={this.props.renderCluster}
                      key={`cluster-${d.properties.cluster_id}`}
                      containerStyle={this.props.containerStyle}
                      clusterInitialFontSize={this.props.clusterInitialFontSize}
                      clusterInitialDimension={this.props.clusterInitialDimension} />
              )
            })
          }
          {
            !this.props.clusteringEnabled && this.props.data.map(d => this.props.renderMarker(d))
          }
          {this.ungroupLines.length > 0
              ? this.ungroupLines.map((group) =>
              {
                //console.warn(group);
                return (
                    <MapView.Polyline
                        coordinates={group}
                        strokeColor={this.props.polyColor}
                        strokeWidth={2}
                    />
                );
              })
              : null
          }

          {this.groupCenter.length > 0
              ? this.groupCenter.map((center) =>
              {
                //console.warn(center);
                return (
                    <Marker
                        coordinate={center}>
                      <View>
                        <Image source={this.props.imgCenter}/>
                      </View>
                    </Marker>
                );
              })
              : null
          }
          {this.props.children}
        </MapView>
    )
  }
}

ClusteredMapView.defaultProps = {
  minZoom: 1,
  maxZoom: 20,
  extent: 512,
  textStyle: {},
  containerStyle: {},
  animateClusters: true,
  clusteringEnabled: true,
  clusterInitialFontSize: 12,
  clusterInitialDimension: 30,
  clusterPressMaxChildren: 100,
  preserveClusterPressBehavior: true,
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height,
  layoutAnimationConf: LayoutAnimation.Presets.spring,
  edgePadding: { top: 10, left: 10, right: 10, bottom: 10 }
}

ClusteredMapView.propTypes = {
  ...MapView.propTypes,
  // number
  radius: PropTypes.number,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  extent: PropTypes.number.isRequired,
  minZoom: PropTypes.number.isRequired,
  maxZoom: PropTypes.number.isRequired,
  clusterInitialFontSize: PropTypes.number.isRequired,
  clusterPressMaxChildren: PropTypes.number.isRequired,
  clusterInitialDimension: PropTypes.number.isRequired,
  imgCenter: PropTypes.node.isRequired,
  polyColor: PropTypes.string.isRequired,
  // array
  data: PropTypes.array.isRequired,
  // func
  onExplode: PropTypes.func,
  onImplode: PropTypes.func,
  scaleUpRatio: PropTypes.func,
  renderCluster: PropTypes.func,
  onClusterPress: PropTypes.func,
  renderMarker: PropTypes.func.isRequired,
  // bool
  animateClusters: PropTypes.bool.isRequired,
  clusteringEnabled: PropTypes.bool.isRequired,
  preserveClusterPressBehavior: PropTypes.bool.isRequired,
  // object
  textStyle: PropTypes.object,
  containerStyle: PropTypes.object,
  layoutAnimationConf: PropTypes.object,
  edgePadding: PropTypes.object.isRequired,
  // string
}
